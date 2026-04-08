import sys, requests, traceback
from redis_client import send_command_and_wait

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
        
        try:
            update_res = send_command_and_wait(
                dev_id, 
                'set_alarm_server', 
                {
                    'port': 7661,
                    'public_web_base_url': 'https://bioface.uz'
                }, 
                timeout=20.0
            )
            if update_res:
                print(f'-> Natija: {update_res.get("message")}')
            else:
                print('-> Natija olinmadi')
        except Exception as e:
            traceback.print_exc()

if __name__ == '__main__':
    main()
