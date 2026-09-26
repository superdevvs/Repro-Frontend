#!/usr/bin/python3
"""Write reviewed unit templates into an artifact staging directory (no installation)."""
import pathlib,sys
out=pathlib.Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
common='''Restart=on-failure
RestartSec=5
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=read-only
PrivateTmp=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictSUIDSGID=yes
LockPersonality=yes
UMask=0077
Slice=repro-monitor.slice
TimeoutStopSec=20
'''
services={
 'repro-monitor':('repro-monitor','www-data','Environment=REPRO_MONITOR_CONFIG=/etc/repro-monitor/gateway.json\nRuntimeDirectory=repro-monitor\nRuntimeDirectoryMode=0750\nSupplementaryGroups=repro-monitor adm systemd-journal\nReadWritePaths=/var/lib/repro-monitor /run/repro-monitor\nExecStart=/opt/repro-monitor/current/bin/node /opt/repro-monitor/current/app/packages/server-monitor/dist/index.js\n'),
 'repro-monitor-ai':('maverick','repro-monitor','ProtectKernelTunables=no\nAppArmorProfile=repro-monitor-ai\nEnvironment=HOME=/home/maverick\nEnvironment=REPRO_MONITOR_BROKER_CONFIG=/etc/repro-monitor/broker.json\nRuntimeDirectory=repro-monitor-ai\nRuntimeDirectoryMode=0750\nReadWritePaths=/var/lib/repro-monitor-ai /run/repro-monitor-ai\nExecStart=/opt/repro-monitor/current/bin/node /opt/repro-monitor/current/app/packages/server-monitor/dist/ai/broker.js\n'),
 'repro-prometheus':('repro-monitor','repro-monitor','ReadWritePaths=/var/lib/repro-monitor/prometheus\nExecStart=/opt/repro-monitor/current/bin/prometheus --config.file=/etc/repro-monitor/prometheus.yml --storage.tsdb.path=/var/lib/repro-monitor/prometheus --storage.tsdb.retention.time=90d --storage.tsdb.retention.size=5GB --web.listen-address=127.0.0.1:9095\n'),
 'repro-loki':('repro-monitor','repro-monitor','ReadWritePaths=/var/lib/repro-monitor/loki\nExecStart=/opt/repro-monitor/current/bin/loki -config.file=/etc/repro-monitor/loki.yml\n'),
 'repro-alloy':('maverick','repro-monitor','UMask=0027\nSupplementaryGroups=adm systemd-journal www-data\nReadWritePaths=/var/lib/repro-monitor/alloy\nExecStart=/opt/repro-monitor/current/bin/alloy run --storage.path=/var/lib/repro-monitor/alloy --server.http.listen-addr=127.0.0.1:12345 /etc/repro-monitor/config.alloy\n'),
}
for name,(user,group,body) in services.items():
 (out/(name+'.service')).write_text('[Unit]\nDescription=RePro '+name+'\nAfter=network-online.target\nWants=network-online.target\nPartOf=repro-monitor.target\n\n[Service]\nType=simple\nUser='+user+'\nGroup='+group+'\n'+common+body+'\n[Install]\nWantedBy=repro-monitor.target\n')
for kind,interval in [('inventory','60s'),('smart','5min')]:
 name='repro-monitor-'+kind
 (out/(name+'.service')).write_text('[Unit]\nDescription=RePro fixed read-only '+kind+' snapshot\n\n[Service]\nType=oneshot\nSlice=repro-monitor.slice\nUser=root\nGroup=www-data\nRuntimeDirectory=repro-monitor-inventory\nRuntimeDirectoryMode=0750\nRuntimeDirectoryPreserve=yes\nNoNewPrivileges=yes\nProtectSystem=strict\nProtectHome=read-only\nPrivateTmp=yes\nReadWritePaths=/run/repro-monitor-inventory\nTimeoutStartSec=30\nExecStart=/usr/bin/python3 /opt/repro-monitor/current/deploy/read-only-inventory.py '+kind+'\n')
 (out/(name+'.timer')).write_text('[Unit]\nDescription=RePro '+kind+' interval\nPartOf=repro-monitor.target\n\n[Timer]\nOnBootSec=15s\nOnUnitActiveSec='+interval+'\nAccuracySec=1s\n\n[Install]\nWantedBy=repro-monitor.target\n')
(out/'repro-monitor.slice').write_text('[Unit]\nDescription=RePro monitoring resource budget\n\n[Slice]\nMemoryAccounting=yes\nCPUAccounting=yes\nMemoryHigh=1800M\nMemoryMax=2G\nCPUQuota=100%\n')
units=' '.join(n+'.service' for n in services)+' repro-monitor-inventory.timer repro-monitor-smart.timer'
(out/'repro-monitor.target').write_text('[Unit]\nDescription=RePro monitoring collection\nWants='+units+'\n\n[Install]\nWantedBy=multi-user.target\n')
