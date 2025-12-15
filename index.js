const Discord = require('discord.js');
const noblox = require('noblox.js');
const express = require('express');

// ==================== CONFIGURACIÓN ====================
const CONFIG = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  GUILD_ID: process.env.GUILD_ID,
  
  // ⚠️ CAMBIA ESTOS IDs POR LOS DE TUS ROLES DE DISCORD ⚠️
  TEAM_ROLES: {
    "1445196585045590136": "President",
  },
  
  CODE_EXPIRATION: 5
};

// ==================== BASES DE DATOS ====================
const verificationCodes = new Map();
const verifiedUsers = new Map();
const robloxToDiscord = new Map();

// ==================== SERVIDOR WEB ====================
const app = express();
app.use(express.json());

app.get('/', (req, res) => res.send('Bot Activo 🟢'));

app.get('/api/team-by-id/:robloxId', async (req, res) => {
  const discordId = robloxToDiscord.get(req.params.robloxId);
  if (!discordId) return res.json({ success: false, team: "Neutral", verified: false });
  
  const userData = verifiedUsers.get(discordId);
  return res.json({
    success: true,
    verified: true,
    team: userData ? userData.team : "Neutral",
    robloxUsername: userData ? userData.robloxUsername : null
  });
});

app.listen(3000, () => console.log('✅ Web Server Online'));

// ==================== DISCORD BOT ====================
const client = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMembers,
    Discord.GatewayIntentBits.GuildMessages,
    Discord.GatewayIntentBits.MessageContent,
    Discord.GatewayIntentBits.DirectMessages
  ]
});

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

function getTeamFromMember(member) {
  for (const [roleId, teamName] of Object.entries(CONFIG.TEAM_ROLES)) {
    if (member.roles.cache.has(roleId)) return teamName;
  }
  return "Neutral";
}

async function verifyRobloxDescription(robloxUsername, expectedCode) {
  try {
    const userId = await noblox.getIdFromUsername(robloxUsername);
    if (!userId) return { success: false, error: 'Usuario no encontrado' };
    
    const info = await noblox.getPlayerInfo(userId);
    if ((info.blurb || '').toUpperCase().includes(expectedCode.toUpperCase())) {
      return { success: true, robloxId: userId, robloxUsername: info.username };
    }
    return { success: false, error: 'Código no encontrado en descripción' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const content = message.content.toLowerCase();

  if (content === '!verificar' || content === '!verify') {
    if (verifiedUsers.has(message.author.id)) return message.reply('✅ Ya estás verificado.');
    
    const code = generateCode();
    verificationCodes.set(message.author.id, { code, expires: Date.now() + 1800000 });
    
    const row = new Discord.ActionRowBuilder().addComponents(
      new Discord.ButtonBuilder().setCustomId('set_username').setLabel('Ingresar Usuario').setStyle(1),
      new Discord.ButtonBuilder().setCustomId('verify_acc').setLabel('Verificar').setStyle(3)
    );

    message.author.send({
      embeds: [{
        title: '🔐 Verificación Roblox',
        description: `1. Copia este código: \`\`\`${code}\`\`\`\n2. Ponlo en tu descripción de Roblox (About).\n3. Presiona **Ingresar Usuario** y luego **Verificar**.`,
        color: 0x5865F2
      }],
      components: [row]
    }).catch(() => message.reply('❌ Abre tus MDs.'));
  }

  if (content === '!team') {
    const data = verifiedUsers.get(message.author.id);
    if (!data) return message.reply('❌ No verificado.');
    
    // Actualizar rol
    const team = getTeamFromMember(message.member);
    data.team = team;
    verifiedUsers.set(message.author.id, data);
    
    message.reply(`👤 Usuario: **${data.robloxUsername}**\n🛡️ Equipo: **${team}**`);
  }
});

client.on('interactionCreate', async (i) => {
  if (i.customId === 'set_username') {
    const modal = new Discord.ModalBuilder().setCustomId('m_user').setTitle('Usuario Roblox');
    modal.addComponents(new Discord.ActionRowBuilder().addComponents(
      new Discord.TextInputBuilder().setCustomId('user').setLabel('Nombre').setStyle(1)
    ));
    await i.showModal(modal);
  }

  if (i.isModalSubmit() && i.customId === 'm_user') {
    const user = i.fields.getTextInputValue('user');
    const data = verificationCodes.get(i.user.id);
    if (data) {
      data.robloxUsername = user;
      verificationCodes.set(i.user.id, data);
      i.reply({ content: `✅ Usuario guardado: **${user}**. Ahora presiona Verificar.`, ephemeral: true });
    }
  }

  if (i.customId === 'verify_acc') {
    await i.deferReply({ ephemeral: true });
    const data = verificationCodes.get(i.user.id);
    if (!data || !data.robloxUsername) return i.editReply('❌ Falta usuario o código expiró.');

    const res = await verifyRobloxDescription(data.robloxUsername, data.code);
    if (res.success) {
      const team = i.member ? getTeamFromMember(i.member) : "Neutral";
      verifiedUsers.set(i.user.id, { discordId: i.user.id, robloxId: res.robloxId, robloxUsername: res.robloxUsername, team });
      robloxToDiscord.set(res.robloxId.toString(), i.user.id);
      verificationCodes.delete(i.user.id);
      i.editReply(`✅ **¡Verificado!** Eres: ${res.robloxUsername}. Equipo: ${team}`);
    } else {
      i.editReply(`❌ Error: ${res.error}`);
    }
  }
});

client.login(CONFIG.DISCORD_TOKEN);