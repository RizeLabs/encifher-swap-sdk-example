import { DefiClient, DefiClientConfig, DepositParams, Token } from 'encifher-swap-sdk';
import { Keypair, Connection, sendAndConfirmTransaction } from '@solana/web3.js';
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

    // config for token to deposit
    const token: Token = {
        tokenMintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        decimals: 6,
    };

    // establishing connection and defi client
    const connection = new Connection(rpcUrl);
    const config: DefiClientConfig = { encifherKey, rpcUrl };
    const defiClient = new DefiClient(config);

    // params for depositing funds
    const depositParams: DepositParams = {
        token,
        depositor: userKeyPair.publicKey,
        amount: '100000', // 0.1 USDC 
    };

    // constructing and sending deposit transaction
    try {
        const depositTxn = await defiClient.getDepositTxn(depositParams);
        depositTxn.partialSign(userKeyPair);
        const {
            context: { slot: minContextSlot },
        } = await connection.getLatestBlockhashAndContext();
        const txnSig = await sendAndConfirmTransaction(connection, depositTxn, [userKeyPair], {
            minContextSlot,
            preflightCommitment: 'confirmed',
            commitment: 'confirmed',
        });
        console.log('Deposit successful:', txnSig);
    } catch (err) {
        console.error('Deposit failed:', err);
    }

    // wait for a few seconds to ensure encrypted transaction is processed
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // fetch post-deposit balance
    try {
        const msgPayload = await defiClient.getMessageToSign();
        const sigBuff = nacl.sign.detached(Buffer.from(msgPayload.msgHash), userKeyPair.secretKey);
        const signature = Buffer.from(sigBuff).toString('base64');
        const userBalance = await defiClient.getBalance(userKeyPair.publicKey, { signature, ...msgPayload }, [token.tokenMintAddress], encifherKey);
        console.log('User balance after deposit:', userBalance);
    } catch (err) {
        console.error('Balance fetch failed:', err);
    }
};

main().then(() => process.exit(0));