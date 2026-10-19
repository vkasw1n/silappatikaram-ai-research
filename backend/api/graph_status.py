from fastapi import APIRouter

try:
    from ..application.graph_service import Neo4jService
except ImportError:
    from application.graph_service import Neo4jService

router = APIRouter()


@router.get("/status")
def graph_status():
    return Neo4jService().status()