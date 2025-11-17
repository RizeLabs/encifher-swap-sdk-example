import { DefiClient, DefiClientConfig, WithdrawParams, Token } from 'encifher-swap-sdk';
import { Keypair, Connection, sendAndConfirmTransaction, PublicKey } from '@solana/web3.js';
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

    // config for token to withdraw
    const token: Token = {
        tokenMintAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        decimals: 6,
    };

    // establishing connection and defi client
    const connection = new Connection(rpcUrl);
    const config: DefiClientConfig = { encifherKey, rpcUrl, mode: 'Mainnet'};
    const defiClient = new DefiClient(config);

    // params for withdrawing funds
    const withdrawParams: WithdrawParams = {
        token,
        withdrawer: userKeyPair.publicKey,
        amount: '100000', // 0.1 USDC 
        // receiver: new PublicKey('6jkCY6tJZrFAevso5798Qd36Pu1HxLZWS1Y2RXUS3DKz') // optional field 
    };

    // constructing and sending withdraw transaction
    try {
        const withdrawTxn = await defiClient.getWithdrawTxn(withdrawParams);
        withdrawTxn.partialSign(userKeyPair);
        const {
            context: { slot: minContextSlot },
        } = await connection.getLatestBlockhashAndContext();
        const txnSig = await sendAndConfirmTransaction(connection, withdrawTxn, [userKeyPair], {
            minContextSlot,
            preflightCommitment: 'confirmed',
            commitment: 'confirmed',
        });
        console.log('Withdraw successful:', txnSig);
    } catch (err) {
        console.error('Withdraw failed:', err);
    }

    // wait for a few seconds to ensure encrypted transaction is processed
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // fetch post-withdraw balance
    try {
        const msgPayload = await defiClient.getMessageToSign();
        const sigBuff = nacl.sign.detached(Buffer.from(msgPayload.msgHash), userKeyPair.secretKey);
        const signature = Buffer.from(sigBuff).toString('base64');
        const userBalance = await defiClient.getBalance(
            userKeyPair.publicKey,
            { signature, ...msgPayload },
            [token.tokenMintAddress],
            encifherKey
        );
        console.log('User balance after withdraw:', userBalance);
    } catch (err) {
        console.error('Balance fetch failed:', err);
    }
};

main().then(() => process.exit(0));