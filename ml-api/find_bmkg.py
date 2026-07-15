import requests

def get_bmkg():
    try:
        r = requests.get('https://api.bmkg.go.id/publik/prakiraan-cuaca?adm1=18')
        print(r.json())
    except Exception as e:
        print(e)

get_bmkg()
