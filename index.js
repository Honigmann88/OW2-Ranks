import { Client, GatewayIntentBits } from 'discord.js';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import dotenv from 'dotenv';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const DATA_FILE = 'userData.txt';
const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minute for testing purposes
const LEADERBOARD_CHANNEL_ID = process.env.LEADERBOARD_CHANNEL_ID;
const CAT_API_KEY = process.env.CAT_API_KEY;
const ttoken = process.env.BOT_TOKEN;
client.login(ttoken);



const rankValues = {
    'champion 1': 4900, 'champion 2': 4800, 'champion 3': 4700, 'champion 4': 4600, 'champion 5': 4500,
    'grandmaster 1': 4400, 'grandmaster 2': 4300, 'grandmaster 3': 4200, 'grandmaster 4': 4100, 'grandmaster 5': 4000,
    'master 1': 3900, 'master 2': 3800, 'master 3': 3700, 'master 4': 3600, 'master 5': 3500,
    'diamond 1': 3400, 'diamond 2': 3300, 'diamond 3': 3200, 'diamond 4': 3100, 'diamond 5': 3000,
    'platinum 1': 2900, 'platinum 2': 2800, 'platinum 3': 2700, 'platinum 4': 2600, 'platinum 5': 2500,
    'gold 1': 2400, 'gold 2': 2300, 'gold 3': 2200, 'gold 4': 2100, 'gold 5': 2000,
    'silver 1': 1900, 'silver 2': 1800, 'silver 3': 1700, 'silver 4': 1600, 'silver 5': 1500,
    'bronze 1': 1400, 'bronze 2': 1300, 'bronze 3': 1200, 'bronze 4': 1100, 'bronze 5': 1000,
    'n/a': 0
};

let leaderboardMessages = {
    damage: null,
    support: null,
    tank: null
};

client.once('ready', () => {
    console.log('Bot is online!');
    updateAllUsers(); // Update data immediately on start
    setInterval(updateAllUsers, UPDATE_INTERVAL); // Schedule periodic updates
});

client.on('messageCreate', async message => {

    if (message.content === '!lb'){
        try {
            LEADERBOARD_CHANNEL_ID = message.channelId;
        } catch{
            console.error('Error fetching cat gif:', error);
            message.reply('Failed to get the channelID. Please try again.');
        }

    }

    if (message.content === '!cat') {
        try {
            const response = await axios.get('https://api.thecatapi.com/v1/images/search?mime_types=gif', {
                headers: {
                    'x-api-key': CAT_API_KEY
                }
            });

            const catGifUrl = response.data[0].url;
            message.channel.send(catGifUrl);
        } catch (error) {
            console.error('Error fetching cat gif:', error);
            message.reply('Failed to fetch a cat gif. Please try again later.');
        }
    }
    
    if (message.content.startsWith('!sign')) {
        console.log(message.channelId);
        const args = message.content.split(' ');
        if (args.length !== 2) {
            return message.reply('Please use the correct format: !sign <gameName>');
        }

        const gameName = args[1];
        const discordName = message.author.tag;

        try {
            const userData = await readUserData();

            let existingUserIndex = userData.findIndex(user => user.discordName === discordName);

            if (existingUserIndex !== -1) {
                const data = await fetchPlayerData(gameName);
                if (!data) {
                    return message.reply('Failed to fetch data. Please check the game name.');
                }

                userData[existingUserIndex].gameName = gameName;
                userData[existingUserIndex].damage = `${data.damageDivision}-${data.damageTier}`;
                userData[existingUserIndex].support = `${data.supportDivision}-${data.supportTier}`;
                userData[existingUserIndex].tank = `${data.tankDivision}-${data.tankTier}`;

                await saveUserData(userData);
                message.reply('Your data has been updated successfully.');
                updateLeaderboards(userData, message.guild);
            } else {
                const data = await fetchPlayerData(gameName);
                if (!data) {
                    return message.reply('Failed to fetch data. Please check the game name.');
                }

                const newUser = {
                    gameName,
                    discordName,
                    damage: `${data.damageDivision}-${data.damageTier}`,
                    support: `${data.supportDivision}-${data.supportTier}`,
                    tank: `${data.tankDivision}-${data.tankTier}`
                };

                userData.push(newUser);
                await saveUserData(userData);

                message.reply('Your data has been saved successfully.');
                updateLeaderboards(userData, message.guild);
            }
        } catch (error) {
            console.error('Error:', error);
            message.reply('There was an error processing your request.');
        }
    }
});


// Helper functions

async function fetchPlayerData(gameName) {
    try {
        const response = await fetch(`https://overfast-api.tekrop.fr/players/${gameName}/summary`);
        if (!response.ok) {
            throw new Error('Failed to fetch data');
        }
        const data = await response.json();
        // console.log('Fetched data:', data);
        return {
            damageDivision: data.competitive?.pc?.damage?.division || 'N/A',
            damageTier: data.competitive?.pc?.damage?.tier || 'N/A',
            supportDivision: data.competitive?.pc?.support?.division || 'N/A',
            supportTier: data.competitive?.pc?.support?.tier || 'N/A',
            tankDivision: data.competitive?.pc?.tank?.division || 'N/A',
            tankTier: data.competitive?.pc?.tank?.tier || 'N/A'
        };
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}

async function readUserData() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return data.split('\n').filter(line => line).map(line => {
            const [gameName, discordName, damage, support, tank] = line.split(';');
            return { gameName, discordName, damage, support, tank };
        });
    } catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }
        throw error;
    }
}

async function saveUserData(userData) {
    const data = userData.map(user => `${user.gameName};${user.discordName};${user.damage};${user.support};${user.tank}`).join('\n');
    await fs.writeFile(DATA_FILE, data, 'utf8');
}

async function updateAllUsers() {
    try {
        const userData = await readUserData();
        for (let user of userData) {
            const updatedData = await fetchPlayerData(user.gameName);
            if (updatedData) {
                user.damage = `${updatedData.damageDivision}-${updatedData.damageTier}`;
                user.support = `${updatedData.supportDivision}-${updatedData.supportTier}`;
                user.tank = `${updatedData.tankDivision}-${updatedData.tankTier}`;
            }
        }
        await saveUserData(userData);
        console.log('User data updated successfully.');

        const guild = client.guilds.cache.first();
        if (guild) {
            updateLeaderboards(userData, guild);
        }
    } catch (error) {
        console.error('Error updating user data:', error);
    }
}

function calculateRankScore(rank) {
    rank = rank.toLowerCase(); // Ensure rank is in lowercase
    console.log('Calculating score for rank:', rank); // Log the rank
    const score = rankValues[rank] || 0;
    console.log('Score for rank:', rank, 'is', score); // Log the score
    return score;
}

function updateLeaderboards(userData, guild) {
    const damageLeaderboard = generateLeaderboard(userData, 'damage');
    const supportLeaderboard = generateLeaderboard(userData, 'support');
    const tankLeaderboard = generateLeaderboard(userData, 'tank');

    console.log('Damage Leaderboard:', damageLeaderboard);
    console.log('Support Leaderboard:', supportLeaderboard);
    console.log('Tank Leaderboard:', tankLeaderboard);

    updateLeaderboardMessage(guild, 'damage', damageLeaderboard);
    updateLeaderboardMessage(guild, 'support', supportLeaderboard);
    updateLeaderboardMessage(guild, 'tank', tankLeaderboard);
}

function generateLeaderboard(userData, role) {
    return userData
        .map(user => {
            const [division, tier] = user[role].split('-');
            const rank = `${division} ${tier}`;
            console.log(`User: ${user.discordName}, Role: ${role}, Rank: ${rank}`);
            const score = calculateRankScore(rank);
            return { discordName: user.discordName, score, rank};
        })
        .sort((a, b) => b.score - a.score)
        .map((user, index) => `${index + 1}. ${user.discordName}: ${user.rank}`)
        .join('\n');
}

/* 
async function updateLeaderboardMessage(guild, role, leaderboard) {
    const channel = guild.channels.cache.get(LEADERBOARD_CHANNEL_ID);
    if (!channel) {
        console.error(`Channel with ID ${LEADERBOARD_CHANNEL_ID} not found`);
        return;
    }
    console.log(`Found channel ${channel.name} with ID ${channel.id}`);

    if (leaderboardMessages[role]) {
        try {
            const message = await channel.messages.fetch(leaderboardMessages[role]);
            if (message) {
                await message.edit(`**${role.toUpperCase()} LEADERBOARD**\n\n${leaderboard}`);
                return;
            }
        } catch (error) {
            console.error('Error fetching message:', error);
        }
    }

    try {
        const sentMessage = await channel.send(`**${role.toUpperCase()} LEADERBOARD**\n\n${leaderboard}`);
        leaderboardMessages[role] = sentMessage.id;
    } catch (error) {
        console.error('Error sending leaderboard message:', error);
    }
}
*/

async function updateLeaderboardMessage(guild, role, leaderboard) {
    const channel = guild.channels.cache.get(LEADERBOARD_CHANNEL_ID);

    if (leaderboardMessages[role]) {
        try {
            const message = await channel.messages.fetch(leaderboardMessages[role]);
            if (message) {
                await message.edit(`**${role.toUpperCase()} LEADERBOARD**\n\n\`\`\`${leaderboard}\`\`\``);
                return;
            }
        } catch (error) {
            console.error('Error fetching message:', error);
        }
    }

    const sentMessage = await channel.send(`**${role.toUpperCase()} LEADERBOARD**\n\n\`\`\`${leaderboard}\`\`\``);
    leaderboardMessages[role] = sentMessage.id;
}