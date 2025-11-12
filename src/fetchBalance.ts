import { DefiClient, DefiClientConfig, Token } from 'encifher-swap-sdk';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import dotenv from 'dotenv';
import nacl from 'tweetnacl';

dotenv.config();

const main = async () => {
    // Replace with actual values for your environment
    const encifherKey = process.env.SDK_KEY || '';
    const rpcUrl = process.env.RPC_URL || '';
    const secretKey = process.env.DUMMY_KEY || '';

    // test user
    const userKeyPair = Keypair.fromSecretKey(bs58.decode(secretKey));
    console.log('User public key:', userKeyPair.publicKey.toBase58());

    // tokens config 
    const usdc: Token = {
        tokenMintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        decimals: 6,
    };
    const usdt: Token = {
        tokenMintAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        decimals: 6,
    }

    // establishing defi client
    const config: DefiClientConfig = { encifherKey, rpcUrl };
    const defiClient = new DefiClient(config);

    const mints = await defiClient.getUserTokenMints(userKeyPair.publicKey);
    const userTokenMints = mints.map((mintObj) => mintObj.mint);
    console.log('User token mints', userTokenMints);

    // fetch post-deposit balance
    try {
        const msgPayload = await defiClient.getMessageToSign();
        const sigBuff = nacl.sign.detached(Buffer.from(msgPayload.msgHash), userKeyPair.secretKey);
        const signature = Buffer.from(sigBuff).toString('base64');
        const userBalance = await defiClient.getBalance(
            userKeyPair.publicKey,
            { signature, ...msgPayload },
            userTokenMints,
            encifherKey
        );
        console.log('User balances:', userBalance);
    } catch (err) {
        console.error('Balance fetch failed:', err);
    }
};

main().then(() => process.exit(0));