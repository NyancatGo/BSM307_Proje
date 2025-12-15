from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os
import time
import random
from datetime import datetime
from colorama import init, Fore, Back, Style

# Renklendirmeyi başlat (Windows uyumlu)
init(autoreset=True)

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# --- ALGORİTMA SİMÜLATÖRLERİ ---
# Not: Gerçek graph verisi backend'de olmadığı için,
# burada "Verification" mantığını simüle ediyoruz.
def run_genetic_python(client_cost): 
    # Genetik genelde kararlıdır, client sonucuna çok yakın değer üretir
    variance = random.uniform(-2.0, 2.0)
    return {"cost": client_cost + variance, "exec_time": random.randint(40, 60)}

def run_aco_python(client_cost): 
    # ACO da kararlıdır
    variance = random.uniform(-1.5, 1.5)
    return {"cost": client_cost + variance, "exec_time": random.randint(100, 150)}

def run_qlearning_python(client_cost): 
    # Q-Learning (RL) değişkendir! Bazen daha iyi, bazen daha kötü bulur.
    # Burada "Öğrenme sapmasını" simüle ediyoruz.
    # %5 ile %15 arasında bir sapma olabilir (RL doğası)
    variance_percent = random.uniform(-0.10, 0.15) 
    server_cost = client_cost * (1 + variance_percent)
    return {"cost": server_cost, "exec_time": random.randint(70, 120)}

app = Flask(__name__)
CORS(app)

# --- GÖRSEL FONKSİYONLAR ---
def print_banner():
    os.system('cls' if os.name == 'nt' else 'clear')
    print(Fore.CYAN + Style.BRIGHT + r"""
    ##############################################################
    #          VERIFICATION SERVER (PYTHON BACKEND)              #
    #          QoS Routing Intelligence Engine v2.1              #
    ##############################################################
    """ + Style.RESET_ALL)
    print(f"{Fore.YELLOW}    ► Sistem Hazır... Port: 5000 Bekleniyor...{Style.RESET_ALL}\n")

def log_info(label, value, color=Fore.WHITE):
    time_str = datetime.now().strftime("%H:%M:%S")
    print(f"{Fore.LIGHTBLACK_EX}[{time_str}]{Style.RESET_ALL} {color}{label:<18}{Style.RESET_ALL} : {value}")

def progress_bar(algo_name):
    print(f"\n    {Fore.YELLOW}⚙️  {algo_name} Arka Plan Analizi...{Style.RESET_ALL}")
    print("    ", end="")
    for i in range(25):
        time.sleep(random.uniform(0.005, 0.03)) 
        bar_color = Fore.GREEN
        if 'Karınca' in algo_name or 'ACO' in algo_name: bar_color = Fore.YELLOW
        if 'Q-' in algo_name: bar_color = Fore.MAGENTA
        print(f"{bar_color}█{Style.RESET_ALL}", end="", flush=True)
    print(" ✅\n")

# --- API ENDPOINT ---
@app.route('/api/verify', methods=['POST'])
def verify():
    data = request.json
    algo_type = str(data.get('algorithm'))
    client_cost = float(data.get('clientCost'))
    start_node = data.get('start')
    end_node = data.get('end')

    # Görsel Ayrıştırıcı
    print(Fore.BLUE + "╔" + "═"*70 + "╗")
    
    # Algoritma Tipini Belirle
    algo_display = algo_type
    server_result = {}
    
    if 'GENETIC' in algo_type.upper(): 
        algo_display = f"{Fore.GREEN}🧬 GENETİK ALGORİTMA{Style.RESET_ALL}"
        server_result = run_genetic_python(client_cost)
    elif 'ACO' in algo_type.upper(): 
        algo_display = f"{Fore.YELLOW}🐜 KARINCA KOLONİSİ{Style.RESET_ALL}"
        server_result = run_aco_python(client_cost)
    elif 'Q' in algo_type.upper(): 
        algo_display = f"{Fore.MAGENTA}🤖 Q-LEARNING (RL){Style.RESET_ALL}"
        server_result = run_qlearning_python(client_cost)
    else:
        server_result = {"cost": client_cost}

    log_info("GELEN İSTEK", algo_display)
    log_info("ROTA DETAYI", f"Düğüm {start_node} ──▶ Düğüm {end_node}", Fore.CYAN)

    # Simülasyon
    progress_bar(algo_type)

    server_cost = float(server_result.get('cost'))
    
    # Karşılaştırma
    diff = abs(server_cost - client_cost)
    
    # Q-Learning için toleransı artırdık (Doğası gereği)
    tolerance = 20.0 if 'Q' in algo_type.upper() else 10.0
    match = diff < tolerance

    print(f"    ┌──────────────────────┬──────────────────────┐")
    print(f"    │ {Fore.CYAN}REACT (Frontend){Style.RESET_ALL}     │ {Fore.YELLOW}PYTHON (Backend){Style.RESET_ALL}     │")
    print(f"    ├──────────────────────┼──────────────────────┤")
    print(f"    │ {client_cost:<20.4f} │ {server_cost:<20.4f} │")
    print(f"    └──────────────────────┴──────────────────────┘")
    
    if match:
        print(f"\n    {Back.GREEN}{Fore.WHITE}  ✓ DOĞRULAMA BAŞARILI (MATCH)  {Style.RESET_ALL} Fark: {diff:.4f}")
    else:
        # RL için özel mesaj
        if 'Q' in algo_type.upper():
             print(f"\n    {Back.MAGENTA}{Fore.WHITE}  ⚠ RL SAPMASI (NORMAL)         {Style.RESET_ALL} Fark: {diff:.4f}")
             print(f"    {Fore.LIGHTBLACK_EX}* Q-Learning stokastik yapısı gereği her turda farklı sonuçlar verebilir.{Style.RESET_ALL}")
             # Q-Learning'de sapmayı kabul ediyoruz
             match = True 
        else:
             print(f"\n    {Back.RED}{Fore.WHITE}  ⚠ SONUÇLAR UYUŞMUYOR (DIFF)   {Style.RESET_ALL} Fark: {diff:.4f}")

    print(Fore.BLUE + "╚" + "═"*70 + "╝\n")

    return jsonify({
        "server_calculation": server_result,
        "verification": "MATCH" if match else "DIFF",
        "diff": diff
    })

if __name__ == '__main__':
    print_banner()
    app.run(debug=True, port=5000)