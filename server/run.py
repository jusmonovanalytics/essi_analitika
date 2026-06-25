import asyncio
import selectors
import sys
import uvicorn


async def serve():
    config = uvicorn.Config("main:app", host="127.0.0.1", port=8001, loop="none")
    server = uvicorn.Server(config)
    await server.serve()


if __name__ == "__main__":
    if sys.platform == "win32":
        # Python 3.12+: loop_factory forces SelectorEventLoop (psycopg3 requirement)
        asyncio.run(serve(), loop_factory=lambda: asyncio.SelectorEventLoop(selectors.SelectSelector()))
    else:
        asyncio.run(serve())
