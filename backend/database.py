from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 1. Define the database URL (We are using SQLite for now, it creates a file locally)
SQLALCHEMY_DATABASE_URL = "sqlite:///./marroncorp.db"

# 2. Create the database engine
# "check_same_thread": False is needed only for SQLite
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# 3. Create a SessionLocal class
# Each instance of this class will be a database session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 4. Create a Base class
# Later, we will inherit from this class to create our database models
Base = declarative_base()

# 5. Dependency helper function (Used in API routes)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()