
import os
import json
import sys

try:
    path = "fohat-energia-3c422e081e0e.json"
    print(f"Tentando ler {path}...")
    with open(path, 'r') as f:
        data = json.load(f)
    print("Leitura OK. Project ID:", data.get('project_id'))
except Exception as e:
    print(f"Erro na leitura: {e}")

try:
    import firebase_admin
    from firebase_admin import credentials
    print("Import OK.")
    cred = credentials.Certificate(path)
    print("Credential Certificate criado OK.")
    app = firebase_admin.initialize_app(cred)
    print("Initialize App OK.")
except Exception as e:
    print(f"Erro no Firebase Admin: {e}")


