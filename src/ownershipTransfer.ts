import { AnonTransferParams, DefiClient, DefiClientConfig, SignedAnonTransferParams, Token } from 'encifher-swap-sdk';
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

    const userKeyPair = Keypair.fromSecretKey(bs58.decode(secretKey));
    console.log('Sender public key:', userKeyPair.publicKey.toBase58());

    const receiverKeyPair = Keypair.generate();
    console.log('Receiver Public Key', receiverKeyPair.publicKey.toBase58());

    // token-in config 
    const tokenIn: Token = {
        tokenMintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        decimals: 6,
    };

    // establishing defi client
    const config: DefiClientConfig = { encifherKey, rpcUrl, mode: 'Mainnet' };
    const defiClient = new DefiClient(config);

    // checking wrapped usdc balance 
    try {
        const msgPayload = await defiClient.getMessageToSign();
        const sigBuff = nacl.sign.detached(Buffer.from(msgPayload.msgHash), userKeyPair.secretKey);
        const signature = Buffer.from(sigBuff).toString('base64');
        const userBalance = await defiClient.getBalance(
            userKeyPair.publicKey,
            { signature, ...msgPayload },
            [tokenIn.tokenMintAddress],
            encifherKey
        );
        console.log('Sender balances:', userBalance);
    } catch (err) {
        console.error('Balance fetch failed:', err);
    }

    // transferring wrap using anon transfer
    const anonTransferParams: AnonTransferParams = {
        sender: userKeyPair.publicKey.toBase58(),
        receiver: receiverKeyPair.publicKey.toBase58(),
        amount: '100000',
        tokenMint: tokenIn.tokenMintAddress,
    };

    // get msg to sign for anon transfer
    const anonTransferMsgToSign = await defiClient.getAnonTransferMessageToSign(anonTransferParams);

    // signing msg 
    const signatureBuff = nacl.sign.detached(new TextEncoder().encode(anonTransferMsgToSign.msgHash), userKeyPair.secretKey);
    const signature = bs58.encode(signatureBuff);

    // contruct signed params for anon transfer
    const signedAnonTransferParams: SignedAnonTransferParams = {
        signature,
        extendedAnonTransferParams: anonTransferMsgToSign.extendedAnonTransferParams,
    }

    const txnSignature = await defiClient.sendSignedAnonTransferParams(signedAnonTransferParams);
    console.log('Anon Transfer Txn Signature', txnSignature);

    // check balance of receiver 
    try {
        const msgPayload = await defiClient.getMessageToSign();
        const sigBuff = nacl.sign.detached(Buffer.from(msgPayload.msgHash), receiverKeyPair.secretKey);
        const signature = Buffer.from(sigBuff).toString('base64');
        const receiverBalance = await defiClient.getBalance(
            receiverKeyPair.publicKey,
            { signature, ...msgPayload },
            [tokenIn.tokenMintAddress],
            encifherKey
        );
        console.log('Receiver balances:', receiverBalance);
    } catch (err) {
        console.error('Balance fetch failed:', err);
    }
}

main().then(() => process.exit(0));