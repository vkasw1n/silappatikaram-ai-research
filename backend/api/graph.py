from fastapi import APIRouter, HTTPException, Query

try:
    from ..application.graph_service import get_repository
except ImportError:
    from application.graph_service import get_repository

router = APIRouter()


def _not_found(identifier: str) -> HTTPException:
    return HTTPException(status_code=404, detail=f"Graph node not found: {identifier}")


@router.get("/entity/{entity_id}")
def entity(entity_id: str):
    try:
        return get_repository().entity(entity_id)
    except KeyError:
        raise _not_found(entity_id)


@router.get("/subgraph/{entity_id}")
def subgraph(entity_id: str):
    try:
        return get_repository().subgraph(entity_id)
    except KeyError:
        raise _not_found(entity_id)


@router.get("/passage/{passage_id}")
def passage(passage_id: str):
    try:
        return get_repository().passage(passage_id)
    except KeyError:
        raise _not_found(passage_id)


@router.get("/search")
def search(q: str, hops: int = Query(1, ge=1, le=2)):
    try:
        return get_repository().search(q, hops)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error