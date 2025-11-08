import { BalanceParams, DefiClient, OrderStatusParams, SignedSwapParams, DefiClientConfig, DepositParams, WithdrawParams, Token } from 'encifher-swap-sdk';
import { Keypair, Connection } from '@solana/web3.js';
import dotenv from 'dotenv';
import nacl from 'tweetnacl';

dotenv.config();

const main = async () => {

    // Replace with actual values for your environment
    const encifherKey = process.env.SDK_KEY || '';
    const rpcUrl = process.env.RPC_URL || '';
    const secretKey = process.env.DUMMY_KEY || '';

    // test user
    const userKeyPair = Keypair.fromSecretKey(Buffer.from(secretKey, 'base64'));
    console.log('User Public Key', userKeyPair.publicKey);

    // token in config 
    const tokenIn: Token = {
        tokenMintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        decimals: 6,
    };

    // token out config
    const tokenOut: Token = {
        tokenMintAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        decimals: 6,
    }

    const publicKey = userKeyPair.publicKey;
    const connection = new Connection(rpcUrl);

    const config: DefiClientConfig = { encifherKey, rpcUrl };
    const defiClient = new DefiClient(config);

    // params for depositing funds for swap
    const depositParams: DepositParams = {
        token: tokenIn,
        depositor: publicKey,
        amount: '1000000', // 1 USDC 
    };

    // constructing and sending deposit transaction
    try {
        const depositTxn = await defiClient.getDepositTxn(depositParams);
        depositTxn.partialSign(userKeyPair);

        const {
            context: { slot: minContextSlot },
            value: { blockhash, lastValidBlockHeight },
        } = await connection.getLatestBlockhashAndContext();

        const txSignature = await connection.sendRawTransaction(
            depositTxn.serialize(),
            {
                minContextSlot,
                preflightCommitment: 'confirmed'
            }
        );

        await connection.confirmTransaction(
            txSignature,
            "confirmed"
        );
    } catch (err) {
        console.error('Deposit failed:', err);
    }

    // --- WITHDRAW DEMO ---
    const withdrawParams: WithdrawParams = {
        token: tokenIn,
        amount: '100000', // withdrawing/unwrapping 0.1 USDC
        withdrawer: publicKey,
    };

    try {
        const withdrawTxn = await defiClient.getWithdrawTxn(withdrawParams);
        
        // Sign the transaction
        withdrawTxn.partialSign(userKeyPair);
        
        const {
            context: { slot: minContextSlot },
            value: { blockhash, lastValidBlockHeight },
        } = await connection.getLatestBlockhashAndContext();

        const txSignature = await connection.sendRawTransaction(
            withdrawTxn.serialize(),
            {
                minContextSlot,
                preflightCommitment: 'confirmed'
            }
        );

        await connection.confirmTransaction(
            txSignature,
            "confirmed"
        );
    } catch (err) {
        console.error('Withdraw failed:', err);
    }

    // --- SWAP QUOTE DEMO ---
    const quoteParams = {
        inMint: tokenIn.tokenMintAddress,
        outMint: tokenOut.tokenMintAddress, // For demo, use same token; replace with real outMint for real swaps
        amountIn: '500000', // Example: swapping 0.5 USDC to tokenOut
    };

    try {
        const quote = await defiClient.getSwapQuote(quoteParams);
        console.log('Swap Quote:', quote);
    } catch (err) {
        console.error('Swap quote failed:', err);
    }

    // --- SWAP TXN DEMO ---
    const swapParams = {
        inMint: tokenIn.tokenMintAddress,
        outMint: tokenOut.tokenMintAddress, // For demo, use same token; replace with real outMint for real swaps
        amountIn: '500000', // Example: 0.5 USDC
        senderPubkey: publicKey,
        receiverPubkey: publicKey, // For demo, send to self
    };

    let swapTxn;
    try {
        swapTxn = await defiClient.getSwapTxn(swapParams);
        console.log('Swap txn', swapTxn);
    } catch (err) {
        console.error('Swap txn failed:', err);
    }

    // signing swapTxn
    // this transaction is not needed to be broadcasted
    swapTxn?.partialSign(userKeyPair);

    const signedSwapParams: SignedSwapParams = {
        serializedTxn: swapTxn?.serialize().toString('base64') || '', // since this is already a signed transaction
        orderDetails: {
            inMint: tokenIn.tokenMintAddress,
            outMint: tokenOut.tokenMintAddress,
            amountIn: '500000',
            senderPubkey: publicKey,
            receiverPubkey: publicKey,
        }
    };

    let executeResponse;
    try {
        executeResponse = await defiClient.executeSwapTxn(signedSwapParams);
    } catch (err) {
        console.error('Execute swap failed:', err);
    }

    // keep polling for the swap status 
    try {
        const MAX_TRIES = 40;
        for (let i = 0; i < MAX_TRIES; i++) {

            // targetHandle: string, publicKey: string, encifherKey: string
            const orderStatusParams: OrderStatusParams = {
                orderStatusIdentifier: executeResponse?.orderStatusIdentifier!
            }

            const status = await defiClient.getOrderStatus(orderStatusParams);
            console.log('Status fetched: ', status);
            if (status.status === 'completed') {
                console.log('Order Completed');
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    } catch (err) {
        console.error('Status fetch error', err);
    }

    // flow for quering user balance
    try {
        const msgPayload = await defiClient.getMessageToSign();
        const sigBuff = nacl.sign.detached(Buffer.from(msgPayload.msgHash), userKeyPair.secretKey);
        const signature = Buffer.from(sigBuff).toString('base64');
        const userBalance = await defiClient.getBalance(publicKey, { signature, ...msgPayload }, [tokenIn.tokenMintAddress, tokenOut.tokenMintAddress], encifherKey);
        console.log('User balance for a tokens', publicKey.toBase58(), userBalance);
    } catch (err) {
        console.error('Balance failed:', err);
    }
};

main();