"""FastAPI 应用入口。"""
from __future__ import annotations

import logging
from typing import List
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv, find_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, defaults, hosts, install, nornir, license, snmp, terminal, users
from services.snmp_scheduler import snmp_scheduler

logging.basicConfig(level=logging.INFO)

load_dotenv(find_dotenv())


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理。"""
    # 启动时
    logging.info("Starting SNMP scheduler...")
    snmp_scheduler.start()
    yield
    # 关闭时
    logging.info("Stopping SNMP scheduler...")
    snmp_scheduler.stop()


app = FastAPI(title="Nornir VSR API", version="0.1.0", lifespan=lifespan)

cors_env = os.environ.get("BACKEND_CORS_ORIGINS", "")
origins: List[str] = (
    [o.strip() for o in cors_env.split(",") if o.strip()]
    if cors_env
    else ["http://localhost:3000", "http://127.0.0.1:3000"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(install.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(hosts.router)
app.include_router(defaults.router)
app.include_router(nornir.router)
app.include_router(license.router)
app.include_router(snmp.router)
app.include_router(snmp.router, prefix="/api")
app.include_router(terminal.router)


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}
