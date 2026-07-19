import os
import glob
from rembg import remove

input_dir = 'public/pandas'
output_dir = 'public/pandas_png'

os.makedirs(output_dir, exist_ok=True)
for img_path in glob.glob(os.path.join(input_dir, '*.jpeg')):
    filename = os.path.basename(img_path)
    out_path = os.path.join(output_dir, filename.replace('.jpeg', '.png'))
    print(f"Processing {filename}...")
    with open(img_path, 'rb') as i:
        with open(out_path, 'wb') as o:
            input_data = i.read()
            output_data = remove(input_data)
            o.write(output_data)
print("Done!")
