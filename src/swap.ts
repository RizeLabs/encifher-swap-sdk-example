import { DefiClient, OrderStatusParams, SignedSwapParams, DefiClientConfig, Token, ExecuteSwapResponse } from 'encifher-swap-sdk';
import { Keypair, Transaction } from '@solana/web3.js';
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

    // token-in config 
    const tokenIn: Token = {
        tokenMintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        decimals: 6,
    };
    // token-out config
    const tokenOut: Token = {
        tokenMintAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        decimals: 6,
    }

    // establishing defi client
    const config: DefiClientConfig = { encifherKey, rpcUrl };
    const defiClient = new DefiClient(config);

    // --- SWAP QUOTE DEMO ---
    const swapAmount = '500000'; // Example: swapping 0.5 USDC to USDT
    const quoteParams = {
        inMint: tokenIn.tokenMintAddress,
        outMint: tokenOut.tokenMintAddress,
        amountIn: swapAmount,
    };
    try {
        const quote = await defiClient.getSwapQuote(quoteParams);
        console.log('Swap Quote:', quote);
    } catch (err) {
        console.error('Swap quote fetch failed:', err);
    }

    // --- SWAP TXN DEMO ---
    const swapParams = {
        inMint: tokenIn.tokenMintAddress,
        outMint: tokenOut.tokenMintAddress,
        amountIn: swapAmount,
        senderPubkey: userKeyPair.publicKey,
        receiverPubkey: userKeyPair.publicKey, // For demo, send to self
    };

    let swapTxn: Transaction;
    try {
        swapTxn = await defiClient.getSwapTxn(swapParams);
    } catch (err) {
        console.error('Swap txn generation failed:', err);
        return;
    }

    // signing swapTxn, this transaction does not need to be broadcasted
    swapTxn.partialSign(userKeyPair);

    const signedSwapParams: SignedSwapParams = {
        serializedTxn: swapTxn.serialize().toString('base64'),
        orderDetails: {
            inMint: tokenIn.tokenMintAddress,
            outMint: tokenOut.tokenMintAddress,
            amountIn: '500000',
            senderPubkey: userKeyPair.publicKey,
            receiverPubkey: userKeyPair.publicKey,
        }
    };

    let executeResponse: ExecuteSwapResponse;
    try {
        executeResponse = await defiClient.executeSwapTxn(signedSwapParams);
    } catch (err) {
        console.error('Execute swap failed:', err);
        return;
    }

    // keep polling for the swap status
    const MAX_TRIES = 40;
    for (let i = 0; i < MAX_TRIES; i++) {
        try {
            // targetHandle: string, publicKey: string, encifherKey: string
            const orderStatusParams: OrderStatusParams = {
                orderStatusIdentifier: executeResponse.orderStatusIdentifier!
            }
            const status = await defiClient.getOrderStatus(orderStatusParams);
            console.log(`Attempt ${i}, status fetched: ${status}`);
            if (status.status === 'completed') {
                console.log('Order Completed');
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (err) {
            console.error(`Attempt ${i}, status fetch error: ${err}`);
        }
    }

    // flow for quering user balance
    try {
        const msgPayload = await defiClient.getMessageToSign();
        const sigBuff = nacl.sign.detached(Buffer.from(msgPayload.msgHash), userKeyPair.secretKey);
        const signature = Buffer.from(sigBuff).toString('base64');
        const userBalance = await defiClient.getBalance(
            userKeyPair.publicKey,
            { signature, ...msgPayload },
            [tokenIn.tokenMintAddress, tokenOut.tokenMintAddress],
            encifherKey
        );
        console.log('User balance for tokens:', userKeyPair.publicKey.toBase58(), userBalance);
    } catch (err) {
        console.error('Balance fetch failed:', err);
    }
};

main().then(() => process.exit(0));