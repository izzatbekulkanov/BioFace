import sys
import redis_client
import requests

def main():
    try:
        devices = requests.get('http://127.0.0.1:7670/devices').json()
    except Exception as e:
        print('Failed to get devices')
        sys.exit(1)

    for dev in devices:
        dev_id = dev.get('device_id')
        if not dev_id: continue
        
        print(f'\n========================\nTekshirilmoqda: {dev_id}')
        
        res = redis_client.send_command_and_wait(dev_id, 'get_alarm_server', {}, timeout=15.0)
        if not res or not res.get('ok'):
            print('API Xatolik: Javob olinmadi')
            continue
            
        summary = res.get('summary', {})
        print(f'Joriy holat:\n  Webhook yoniqmi: {summary.get("webhook_enabled")}\n  Urli: {summary.get("webhook_url")}\n  Rasm yuborish: {summary.get("webhook_picture_sending")}')
        
        url = str(summary.get('webhook_url') or '')
        if 'https:' in url or 'bioface' in url or not summary.get('webhook_picture_sending'):
            print("-> DIQQAT: Sozlama noto'g'ri yoki rasm yoqilmagan! IP ga yo'naltirilmoqda...")
            update_res = redis_client.send_command_and_wait(dev_id, 'set_alarm_server', {'public_web_base_url': 'http://94.141.85.147:8000', 'port': 8000}, timeout=20.0)
            if update_res:
                msg = update_res.get('message', "Noma'lum")
                print(f"-> Natija: {msg}")
            else:
                print("-> Natija olinmadi")
        else:
            print("-> Sozlamalar to'g'ri! Kamera ishlashga tayyor.")

if __name__ == '__main__':
    main()
