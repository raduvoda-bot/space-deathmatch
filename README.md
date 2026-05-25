# Space Deathmatch — Online Multiplayer

## Instalare si rulare locala

```bash
# 1. Intra in folder
cd space-deathmatch-online

# 2. Instaleaza dependintele
npm install

# 3. Porneste serverul
node server.js

# 4. Deschide in browser
# http://localhost:3000
```

## Deploy pe Railway (online, gratuit)

1. Creeaza cont pe https://railway.app
2. Instaleaza Railway CLI: `npm install -g @railway/cli`
3. In folderul proiectului:
```bash
railway login
railway init
railway up
```
4. Railway iti da un URL public — trimite-l prietenilor!

## Alternativa: Deploy pe Render.com

1. Creeaza cont pe https://render.com
2. New → Web Service → conecteaza cu GitHub
3. Upload folderul pe GitHub si conecteaza
4. Build command: `npm install`
5. Start command: `node server.js`

## Cum se joaca online

1. Toti 4 deschid acelasi link
2. Fiecare isi pune numele si alege nava (navele sunt unice)
3. Cand toti apasa "Sunt gata!" → jocul incepe
4. Fiecare isi introduce mișcarea in secret pe ecranul lui
5. Cand toti au confirmat → executie simultana
6. Repeat pana ramane un singur jucator
