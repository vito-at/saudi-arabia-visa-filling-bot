"""Генерация ключа шифрования для .env:  python -m db.keygen"""

from cryptography.fernet import Fernet

if __name__ == "__main__":
    print("Скопируйте строку ниже в .env как FILE_ENCRYPTION_KEY=...")
    print(Fernet.generate_key().decode())
