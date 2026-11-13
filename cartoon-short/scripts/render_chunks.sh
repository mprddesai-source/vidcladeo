#!/bin/bash
# usage: render_chunks.sh <Comp> <totalFrames> <chunkFrames> <outName>
set -e
cd ~/cartoon-short
export REMOTION_TMP=~/cartoon-short-tmp TEMP=~/cartoon-short-tmp TMP=~/cartoon-short-tmp TMPDIR=~/cartoon-short-tmp
B=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
G=~/.claude/skills/cartoon-3d-short/scripts/disk_guard.py
C=$1; N=$2; S=$3; O=out/$4; mkdir -p $O
: > $O/list.txt
for ((a=0; a<N; a+=S)); do
  b=$((a+S-1)); ((b>=N)) && b=$((N-1))
  python3 $G --project ~/cartoon-short --tmp $REMOTION_TMP || { echo "disk guard stop"; exit 2; }
  t0=$(date +%s)
  npx remotion render src/index.ts $C $O/part_$a.mp4 --frames=$a-$b --codec=h264 --crf=16 --concurrency=1 --gl=swangle \
    --browser-executable=$B --timeout=240000 --log=error
  echo "chunk $a-$b: $(( $(date +%s)-t0 ))s for $((b-a+1)) frames"
  echo "file 'part_$a.mp4'" >> $O/list.txt
  python3 $G --project ~/cartoon-short --tmp $REMOTION_TMP --cleanup --yes
done
ffmpeg -loglevel error -y -f concat -safe 0 -i $O/list.txt -c copy -an $O/$4.mp4
rm -f $O/part_*.mp4 $O/list.txt
ls -la $O; du -sh ~/cartoon-short-tmp
