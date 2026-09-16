URL=$1
curl -w "TTFB: %{time_starttransfer}s | TOTAL: %{time_total}s | STATUS: %{http_code}\n" -o /dev/null -s "$URL"
