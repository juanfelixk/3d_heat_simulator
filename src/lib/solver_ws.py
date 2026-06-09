import asyncio, json
import websockets
from websockets.exceptions import ConnectionClosedError
from solver import Solver, parse_params

# run with python3 src/lib/solver_ws.py

async def handler(websocket):
    solver = Solver()
    try:
        async for message in websocket:
            msg = json.loads(message)
            msg_type = msg.get("type")

            if msg_type == "RESET":
                solver.cfg = parse_params(msg["payload"])
                solver.reset(solver.cfg.initialTemp)
                await websocket.send(json.dumps({"type": "READY"}))

            elif msg_type == "TICK":
                epoch   = msg.get("epoch", 0)
                new_cfg = parse_params(msg["cfg"]) if msg.get("cfg") else None
                result  = solver.tick(epoch, new_cfg)
                if result:
                    await websocket.send(json.dumps({"type": "STATE", "payload": result}))
                else:
                    await websocket.send(json.dumps({"type": "IDLE"}))

    except ConnectionClosedError:
        pass # client disconnected (refresh, hot reload, tab close) - expected

async def main():
    async with websockets.serve(handler, "localhost", 8765):
        print("Solver WebSocket server running on ws://localhost:8765", flush=True)
        await asyncio.Future()

asyncio.run(main())