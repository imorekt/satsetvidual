import json
import os
import sys
sys.path.append(r'D:\SEMUABOT\deploy')
import base

with open(r'D:\SEMUABOT\deploy\TokenData.json', 'w') as f:
    json.dump({'abi': base.TOKEN_ABI, 'bytecode': base.TOKEN_BYTECODE}, f)
print("TokenData.json created")
