FROM python:3.12-slim
RUN useradd --uid 10001 --create-home app && mkdir /data && chown app /data
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
USER app
ENV PYTHONUNBUFFERED=1 AUDIT_PATH=/data/audit.log
EXPOSE 8443 8081
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=5 \
  CMD python -c "import ssl,urllib.request as u;c=ssl._create_unverified_context();u.urlopen('https://localhost:8443/healthz',context=c,timeout=2)" || exit 1
CMD ["python", "-m", "app.main"]
