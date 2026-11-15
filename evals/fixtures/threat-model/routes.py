from fastapi import APIRouter, Depends

router = APIRouter()


@router.post("/tenants/{tenant}/exports")
def start_export(tenant: str, user=Depends(current_user)):
    # TODO: check that user belongs to tenant
    return queue.enqueue("export", tenant=tenant, requested_by=user.id)


@router.get("/tenants/{tenant}/exports/{export_id}")
def get_export(tenant: str, export_id: str):
    path = f"{tenant}/{export_id}.csv"
    return {"url": bucket.signed_url(path, expires_minutes=1440)}
