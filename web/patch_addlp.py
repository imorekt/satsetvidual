import re

file_path = r'D:\SEMUABOT\deploy\addlp.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_block = r'''    ca_path = os.path.join(script_dir, '2_CA.txt')
    ca_list = []
    if os.path.exists(ca_path):
        with open(ca_path, 'r', encoding='utf-8') as f:
            for line in f:
                ca = line.strip()
                if ca.startswith('0x'):
                    ca_list.append(ca)

    if not ca_list:
        print("[-] File 2_CA.txt kosong atau tidak ditemukan.")
        return

    print(f"[+] Ditemukan {len(ca_list)} token di 2_CA.txt.\n")

    for idx, token_ca in enumerate(ca_list, start=1):
        print(f"\n{'='*55}")
        print(f"[{idx}/{len(ca_list)}] Proses Token: {token_ca}")
        print(f"{'='*55}")
        process_token_lp(w3, wallet, private_key, token_ca)
        time.sleep(2)

    print(f"\n{'='*55}")
    print("SELESAI MEMPROSES SEMUA TOKEN DI 2_CA.TXT")
    print(f"{'='*55}")'''

new_block = r'''    token_ca = input("[?] Masukkan Contract Address (CA): ").strip()
    if not token_ca.startswith('0x'):
        print("[-] CA tidak valid.")
        return

    print(f"\n{'='*55}")
    print(f"[*] Proses Token: {token_ca}")
    print(f"{'='*55}")
    process_token_lp(w3, wallet, private_key, token_ca)

    print(f"\n{'='*55}")
    print("SELESAI MEMPROSES ADD LP")
    print(f"{'='*55}")'''

# Clean up indentation issues for replacement
if 'ca_path = os.path.join(script_dir' in content:
    content = content.replace(old_block, new_block)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Berhasil patch addlp.py")
else:
    print("Tidak menemukan blok yang cocok.")
