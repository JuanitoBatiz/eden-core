$ErrorActionPreference = "Stop"
Write-Host "Iniciando optimización 1: 1080p MP4"
ffmpeg -y -i EdenPromo_Final.mp4 -vcodec libx264 -crf 23 -preset slow -vf scale=1920:-2 -acodec aac -b:a 128k eden-bienvenida-1080p.mp4

Write-Host "Iniciando optimización 2: 1080p WebM"
ffmpeg -y -i EdenPromo_Final.mp4 -c:v libvpx-vp9 -crf 32 -b:v 0 -c:a libopus eden-bienvenida-1080p.webm

Write-Host "Iniciando optimización 3: 720p MP4"
ffmpeg -y -i EdenPromo_Final.mp4 -vcodec libx264 -crf 26 -preset slow -vf scale=1280:-2 -acodec aac -b:a 96k eden-bienvenida-720p.mp4

Write-Host "Iniciando optimización 4: Poster WebP"
ffmpeg -y -i EdenPromo_Final.mp4 -ss 00:00:00.5 -vframes 1 -vf scale=1920:-2 eden-bienvenida-poster.webp

Write-Host "Proceso completado."
