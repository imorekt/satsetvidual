import { ethers } from 'ethers';
import { NextResponse } from 'next/server';

const SIWE_NONCE_URL = "https://opensea.io/__api/auth/siwe/nonce";
const SIWE_VERIFY_URL = "https://opensea.io/__api/auth/siwe/verify";
const GRAPHQL_URL = "https://gql.opensea.io/graphql";
const DROP_ELIGIBILITY_HASH = "d893f026d731e8f14986921fa4229098e018289f6cc7683f8ee2dd83749dd95d";

export async function POST(request) {
    try {
        const { pk, slug } = await request.json();
        
        if (!pk || !slug) {
            return NextResponse.json({ success: false, error: 'Private Key and Slug are required' }, { status: 400 });
        }

        let wallet;
        try {
            wallet = new ethers.Wallet(pk.startsWith('0x') ? pk : '0x' + pk);
        } catch(e) {
            return NextResponse.json({ success: false, error: 'Invalid Private Key' }, { status: 400 });
        }
        const address = wallet.address;
        
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Content-Type": "application/json"
        };
        
        // 1. Get Nonce
        const nonceRes = await fetch(SIWE_NONCE_URL, { method: 'POST', headers });
        if (!nonceRes.ok) throw new Error("Failed to get SIWE nonce");
        const { nonce } = await nonceRes.json();
        
        let cookieParts = [];
        if (nonceRes.headers.getSetCookie) {
            cookieParts.push(...nonceRes.headers.getSetCookie().map(c => c.split(';')[0]));
        } else {
            const raw = nonceRes.headers.get('set-cookie');
            if (raw) cookieParts.push(raw.split(';')[0]);
        }
        
        // 2. Sign Message
        const issuedAt = new Date().toISOString();
        const siweMessage = `opensea.io wants you to sign in with your Ethereum account:\n${address}\n\nClick to sign in and accept the OpenSea Terms of Service (https://opensea.io/tos) and Privacy Policy (https://opensea.io/privacy).\n\nURI: https://opensea.io/\nVersion: 1\nChain ID: 1\nNonce: ${nonce}\nIssued At: ${issuedAt}`;
        
        const signature = await wallet.signMessage(siweMessage);
        
        // 3. Verify
        const verifyBody = {
            message: {
                domain: "opensea.io",
                address,
                statement: "Click to sign in and accept the OpenSea Terms of Service (https://opensea.io/tos) and Privacy Policy (https://opensea.io/privacy).",
                uri: "https://opensea.io/",
                version: "1",
                chainId: "1",
                nonce,
                issuedAt,
                accountType: "Ethereum"
            },
            signature,
            chainArch: "EVM",
            connectorId: "io.metamask"
        };
        
        const verifyRes = await fetch(SIWE_VERIFY_URL, {
            method: 'POST',
            headers: {
                ...headers,
                "Cookie": cookieParts.join('; ')
            },
            body: JSON.stringify(verifyBody)
        });
        
        if (!verifyRes.ok) throw new Error("SIWE verification failed");
        
        if (verifyRes.headers.getSetCookie) {
            cookieParts.push(...verifyRes.headers.getSetCookie().map(c => c.split(';')[0]));
        }
        cookieParts.push(`connected-account-server-hint=${address}`);
        const cookieStr = cookieParts.join('; ');
        
        // 4. GraphQL
        const gqlBody = {
            extensions: {
                persistedQuery: {
                    sha256Hash: DROP_ELIGIBILITY_HASH,
                    version: 1,
                }
            },
            operationName: "DropEligibilityQuery",
            variables: { address, collectionSlug: slug }
        };
        
        const gqlRes = await fetch(GRAPHQL_URL, {
            method: 'POST',
            headers: {
                ...headers,
                "x-app-id": "os2-web",
                "x-graphql-operation-type": "query",
                "origin": "https://opensea.io",
                "referer": "https://opensea.io/",
                "Cookie": cookieStr
            },
            body: JSON.stringify(gqlBody)
        });
        
        if (!gqlRes.ok) {
            if (gqlRes.status === 429) throw new Error("RATE_LIMITED — wait and try again");
            throw new Error(`GraphQL failed: ${gqlRes.status}`);
        }
        
        const gqlData = await gqlRes.json();
        
        if (gqlData.errors) {
            return NextResponse.json({ success: false, error: gqlData.errors[0].message });
        }
        
        const drop = gqlData.data?.dropBySlug || gqlData.data?.drop;
        if (!drop) {
            return NextResponse.json({ success: false, error: "Drop not found — check slug" });
        }
        
        const stages = drop.stages || [];
        if (stages.length === 0) {
            return NextResponse.json({ success: false, error: "No stages found" });
        }
        
        let outputStr = "";
        let labels = [];
        if (stages.length === 4) {
            labels = ["TEAM", "GTD", "FCFS", "PUBLIC"];
        } else if (stages.length === 3) {
            labels = ["GTD", "FCFS", "PUBLIC"];
        } else {
            labels = stages.map((_, i) => `Stage ${i+1}`);
        }
        
        for (let i = 0; i < stages.length; i++) {
            const isEligible = stages[i].isEligible;
            if (isEligible) {
                outputStr += `Stage ${i+1} (${labels[i]}) → ✅ ELIGIBLE\n`;
            } else {
                outputStr += `Stage ${i+1} (${labels[i]}) → ❌ NOT eligible\n`;
            }
        }
        
        return NextResponse.json({ success: true, output: outputStr });
        
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
