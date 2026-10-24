import pytest
from fastapi.testclient import TestClient

from app import main
from app.services.storage import Storage


@pytest.fixture()
def db_path(tmp_path):
    return tmp_path / "test.sqlite3"


@pytest.fixture()
def client(db_path):
    main.set_storage(Storage(db_path))
    with TestClient(main.app) as c:
        yield c
