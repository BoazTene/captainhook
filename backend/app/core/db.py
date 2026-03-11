from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Base(DeclarativeBase):
    pass


engine = create_engine("sqlite:///./captainhook.db", future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def initialize_database() -> None:
    Base.metadata.create_all(bind=engine)

    with engine.begin() as connection:
        inspector = inspect(connection)
        if "events" in inspector.get_table_names():
            existing_columns = {column["name"] for column in inspector.get_columns("events")}
            if "completed_at" not in existing_columns:
                connection.execute(text("ALTER TABLE events ADD COLUMN completed_at DATETIME"))
