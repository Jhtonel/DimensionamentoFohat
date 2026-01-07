
import os
import json
import sys


def main():
    # Segurança: não referenciar arquivos de credenciais no repositório.
    # Use GOOGLE_APPLICATION_CREDENTIALS apontando para um caminho fora do repo.
    path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not path:
        print("GOOGLE_APPLICATION_CREDENTIALS não definido; pulando teste.")
        return 0

    try:
        print(f"Tentando ler {path}...")
        with open(path, 'r') as f:
            data = json.load(f)
        print("Leitura OK. Project ID:", data.get('project_id'))
    except Exception as e:
        print(f"Erro na leitura: {e}")
        return 1

    try:
        import firebase_admin
        from firebase_admin import credentials
        print("Import OK.")
        cred = credentials.Certificate(path)
        print("Credential Certificate criado OK.")
        firebase_admin.initialize_app(cred)
        print("Initialize App OK.")
        return 0
    except Exception as e:
        print(f"Erro no Firebase Admin: {e}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())


