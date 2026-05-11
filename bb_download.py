#!/usr/bin/env python3
"""
Blackboard 课程课件批量下载脚本
用法: python3 bb_download.py <Content页面URL> <Cookie>
"""

import re, os, sys, subprocess, urllib.parse, time

if len(sys.argv) < 3:
    print(__doc__)
    sys.exit(1)

url = sys.argv[1]
cookie = sys.argv[2]

# Extract course_id and content_id including the _1 suffix
course_id = re.search(r'course_id=(_?\d+_\d+)', url).group(1)
content_id = re.search(r'content_id=(_?\d+_\d+)', url).group(1)

# Fetch first page to get course name
first_url = f"https://bb.cuhk.edu.cn/webapps/blackboard/content/listContent.jsp?course_id={course_id}&content_id={content_id}"
html = subprocess.run(["curl", "-sL", "-H", f"Cookie: {cookie}", first_url], capture_output=True, text=True).stdout

# Extract course name from title (e.g., "CSC4001:Software Engineering_L01")
course_name_match = re.search(r'title">([^<]+):([^<_]+)', html)
if course_name_match:
    course_code = course_name_match.group(1)
else:
    course_code = course_id.replace("_", "")

out_dir = os.path.join(os.getcwd(), course_code)
os.makedirs(out_dir, exist_ok=True)

print(f"Course: {course_code}")
print(f"Output: {out_dir}\n")

visited = set()

def process_folder(cid):
    global visited
    if f"{course_id}_{cid}" in visited:
        return []
    visited.add(f"{course_id}_{cid}")
    
    list_url = f"https://bb.cuhk.edu.cn/webapps/blackboard/content/listContent.jsp?course_id={course_id}&content_id={cid}"
    print(f"Crawling: {cid}")
    
    result = subprocess.run(
        ["curl", "-sL", "-H", f"Cookie: {cookie}", list_url],
        capture_output=True, text=True
    )
    html = result.stdout
    
    files = re.findall(r'/bbcswebdav/pid-(\d+)-dt-content-rid-(\d+)_1/xid-\2_1', html)
    # Extract folder IDs with _1 suffix
    folders = [f for f in set(re.findall(r'content_id=(_?\d+_\d+)', html)) 
               if f != cid and f"{course_id}_{f}" not in visited]
    
    print(f"  Files: {len(files)}, Folders: {len(folders)}")
    
    downloaded = []
    base = "https://bb.cuhk.edu.cn/bbcswebdav"
    
    for pid, xid in files:
        file_url = f"{base}/pid-{pid}-dt-content-rid-{xid}_1/xid-{xid}_1"
        
        result2 = subprocess.run(
            ["curl", "-sIL", "-H", f"Cookie: {cookie}", file_url],
            capture_output=True, text=True
        )
        
        filename = None
        for line in result2.stdout.split('\n'):
            if line.startswith('Location:'):
                filename = urllib.parse.unquote(line.split('/')[-1].strip())
                break
        
        if not filename:
            print(f"    Failed: {file_url}")
            continue
            
        filepath = os.path.join(out_dir, filename)
        if os.path.exists(filepath) and os.path.getsize(filepath) > 1000:
            print(f"  Skip: {filename}")
            downloaded.append(filename)
            continue
            
        print(f"  Downloading: {filename}")
        subprocess.run(
            ["curl", "-L", "-H", f"Cookie: {cookie}", "-o", filepath, file_url],
            capture_output=True
        )
        
        if os.path.exists(filepath) and os.path.getsize(filepath) > 1000:
            downloaded.append(filename)
        else:
            print(f"    Failed: {filename}")
            
        time.sleep(0.3)
    
    for fid in folders:
        downloaded += process_folder(fid)
    
    return downloaded

result = process_folder(content_id)
unique_files = set(result)
print(f"\nDone! {len(unique_files)} unique files to {out_dir}")