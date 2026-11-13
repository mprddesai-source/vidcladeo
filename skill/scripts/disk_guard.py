#!/usr/bin/env python3
"""Disk guard for cartoon-3d-short. Exit 0=OK, 1=warn, 2=stop."""
import argparse, os, shutil, sys

CAP_GB = 25
WARN_GB = 18
STOP_GB = 22
MIN_FREE_GB = 5
MAX_BUNDLES = 2
CLEAN_PATTERNS = ("remotion-webpack-bundle-", "puppeteer_dev_chrome_profile-")
GB = 1024 ** 3


def size(path):
    total = 0
    for root, dirs, files in os.walk(path, followlinks=False):
        for f in files:
            fp = os.path.join(root, f)
            try:
                if not os.path.islink(fp):
                    total += os.lstat(fp).st_size
            except OSError:
                pass
    return total


def candidates(tmp):
    out = []
    try:
        for e in os.scandir(tmp):
            if e.name.startswith(CLEAN_PATTERNS) and e.is_dir(follow_symlinks=False) and not e.is_symlink():
                out.append(e.path)
    except FileNotFoundError:
        pass
    return sorted(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", required=True)
    ap.add_argument("--tmp", default=os.environ.get("REMOTION_TMP"))
    ap.add_argument("--list-cleanup", action="store_true")
    ap.add_argument("--cleanup", action="store_true")
    ap.add_argument("--yes", action="store_true")
    a = ap.parse_args()
    if not a.tmp:
        print("disk_guard: pass --tmp or set REMOTION_TMP", file=sys.stderr); return 2
    project = os.path.realpath(os.path.expanduser(a.project))
    tmp = os.path.realpath(os.path.expanduser(a.tmp))
    if tmp in ("/", os.path.realpath(os.path.expanduser("~"))):
        print("disk_guard: refusing / or $HOME as temp folder", file=sys.stderr); return 2

    if a.list_cleanup or a.cleanup:
        c = candidates(tmp)
        for p in c:
            print(f"{size(p) / GB:6.2f} GB  {p}")
        if not c:
            print("nothing to clean")
        if a.cleanup:
            if not a.yes:
                sys.exit("disk_guard: add --yes to actually delete")
            for p in c:
                shutil.rmtree(p)
                print("deleted", p)
        return 0

    proj_b = size(project) if os.path.isdir(project) else 0
    tmp_b = size(tmp) if os.path.isdir(tmp) and not tmp.startswith(project + os.sep) else 0
    used = (proj_b + tmp_b) / GB
    free = shutil.disk_usage(project if os.path.isdir(project) else "/").free / GB
    bundles = sum(1 for p in candidates(tmp) if os.path.basename(p).startswith(CLEAN_PATTERNS[0]))
    print(f"project {proj_b / GB:.2f} GB | tmp {tmp_b / GB:.2f} GB | total {used:.2f}/{CAP_GB} GB | free {free:.1f} GB | bundles {bundles}/{MAX_BUNDLES}")
    if used >= STOP_GB or free < MIN_FREE_GB or bundles > MAX_BUNDLES:
        print("STOP: do not render. Clean up first.")
        return 2
    if used >= WARN_GB:
        print("WARN: approaching the disk cap.")
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
