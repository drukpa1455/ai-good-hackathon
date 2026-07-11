from __future__ import annotations

import asyncio
import os
from pathlib import Path

import psycopg

MIGRATIONS = Path(__file__).resolve().parents[2] / "migrations"


async def apply_migrations(database_url: str) -> None:
    files = sorted(MIGRATIONS.glob("[0-9][0-9][0-9]_*.sql"))
    async with await psycopg.AsyncConnection.connect(database_url) as connection:
        async with connection.transaction():
            await connection.execute(
                "SELECT pg_advisory_xact_lock(hashtext('groundwork-schema-migrations'))"
            )
            await connection.execute(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version text PRIMARY KEY,
                    applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
                )
                """
            )
            rows = await connection.execute("SELECT version FROM schema_migrations")
            applied = {row[0] async for row in rows}
            for path in files:
                if path.name in applied:
                    continue
                for statement in _migration_statements(path.read_text(encoding="utf-8")):
                    await connection.execute(statement)
                await connection.execute(
                    "INSERT INTO schema_migrations (version) VALUES (%s)",
                    (path.name,),
                )


def _migration_statements(script: str) -> tuple[str, ...]:
    return tuple(statement.strip() for statement in script.split(";") if statement.strip())


def main() -> None:
    database_url = os.getenv("DATABASE_URL", "")
    if not database_url:
        raise SystemExit("DATABASE_URL is required")
    asyncio.run(apply_migrations(database_url))


if __name__ == "__main__":
    main()
