const Discord = require('discord.js');
const express = require('express');

// ==================== CONFIGURACIÓN ====================
const CONFIG = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  GUILD_ID: process.env.GUILD_ID,
  
  // ⚠️ PON AQUÍ LOS IDS DE TUS ROLES REALES ⚠️
  TEAM_ROLES: {
    "1445196585045590136": "President",      // Ejemplo: "11223344..." : "Red"
  }
};

// ==================== SERVIDOR WEB ====================
const app = express();
app.use(express.json());

app.get('/', (req, res) => res.send('🤖 Bot Auto-Match Activo'));

// API: Buscar usuario por nombre
app.get('/api/get-team/:username', async (req, res) => {
  const robloxName = req.params.username.toLowerCase();
  
  try {
    const guild = client.guilds.cache.get(CONFIG.GUILD_ID);
    if (!guild) return res.json({ team: "Neutral", error: "Guild no encontrada" });

    // Descargar lista de miembros del servidor para buscar
    // (Esto puede tardar un poco en servidores gigantes)
    const members = await guild.members.fetch();

    // Buscar miembro cuyo Usuario o Apodo coincida con el nombre de Roblox
    const member = members.find(m => 
      m.user.username.toLowerCase() === robloxName || 
      (m.nickname && m.nickname.toLowerCase() === robloxName) ||
      m.displayName.toLowerCase() === robloxName
    );

    if (member) {
      // Si encontramos al usuario, revisamos sus roles
      const team = getTeamFromMember(member);
      console.log(`✅ Match encontrado: ${robloxName} es ${member.user.tag} -> Equipo: ${team}`);
      return res.json({ success: true, team: team, found: true });
    } else {
      console.log(`❌ No se encontró a nadie en Discord llamado: ${robloxName}`);
      return res.json({ success: false, team: "Neutral", found: false });
    }

  } catch (error) {
    console.error(error);
    res.json({ success: false, team: "Neutral", error: "Error interno" });
  }
});

app.listen(3000, () => console.log('✅ API Lista en puerto 3000'));

// ==================== DISCORD BOT ====================
const client = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMembers, // ¡CRUCIAL PARA LEER MIEMBROS!
  ]
});

function getTeamFromMember(member) {
  for (const [roleId, teamName] of Object.entries(CONFIG.TEAM_ROLES)) {
    if (member.roles.cache.has(roleId)) return teamName;
  }
  return "Neutral";
}

client.on('ready', () => {
  console.log(`🔥 Bot conectado como ${client.user.tag}`);
  console.log('Esperando peticiones de Roblox...');
});

client.login(CONFIG.DISCORD_TOKEN);