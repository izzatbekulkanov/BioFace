import requests
with open("test_image.jpg", "wb") as f:
    f.write(b"fake image data")

files = {'image': ('test_image.jpg', open('test_image.jpg', 'rb'), 'image/jpeg')}
data = {
    'first_name': 'Test',
    'last_name': 'Test2',
    'personal_id': '1000001'
}
res = requests.post('http://127.0.0.1:8000/api/cameras/3/users/upload', data=data, files=files)
print(res.status_code)
print(res.json())
