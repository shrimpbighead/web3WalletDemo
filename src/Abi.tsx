import { useEffect, useMemo, useState, useCallback } from "react";
import { BrowserProvider, Contract, type Signer } from "ethers";
import toast, { Toaster } from "react-hot-toast";
// Single-file React Component (TypeScript)
// Features:
// 1) Connect to MetaMask
// 2) Sign random strings with wallet
// 3) Switch chains (supports switching to common EVM-compatible chains)
// 4) Input ABI JSON and contract address
// 5) Generate UI from ABI (supports basic types: address, uint*, int*, bool, string, bytes)
// 6) Call contract methods and display results (view/pure -> call, non-view -> send transaction)

// Usage:
// - Requires: ethers v6
// - Recommended for React + Tailwind projects
// - Demo/skeleton only, can be extended (type validation, arrays, structs, etc.)

type AbiInput = { 
  name: string; 
  type: string;
  internalType?: string;
};
type AbiItem = {
  type: string;
  name?: string;
  inputs?: AbiInput[];
  outputs?: AbiInput[];
  stateMutability?: string;
};

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

type ChainConfig = {
  chainId: string;
  name: string;
  icon: string;
  rpcUrls: string[];
  blockExplorerUrls: string[];
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
};

const CHAIN_MAP: { [k: string]: ChainConfig } = {
  // Ethereum
  ethereum: {
    chainId: "0x1",
    name: "Ethereum Mainnet",
    icon: "⟠",
    rpcUrls: ["https://eth.llamarpc.com"],
    blockExplorerUrls: ["https://etherscan.io"],
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
  sepolia: {
    chainId: "0xaa36a7",
    name: "Ethereum Sepolia",
    icon: "⟠",
    rpcUrls: ["https://rpc.sepolia.org"],
    blockExplorerUrls: ["https://sepolia.etherscan.io"],
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  },
  
  // BNB Smart Chain
  bsc: {
    chainId: "0x38",
    name: "BNB Smart Chain",
    icon: "⬡",
    rpcUrls: ["https://bsc-dataseed1.binance.org"],
    blockExplorerUrls: ["https://bscscan.com"],
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  },
  bscTestnet: {
    chainId: "0x61",
    name: "BSC Testnet",
    icon: "⬡",
    rpcUrls: ["https://data-seed-prebsc-1-s1.binance.org:8545"],
    blockExplorerUrls: ["https://testnet.bscscan.com"],
    nativeCurrency: { name: "Test BNB", symbol: "tBNB", decimals: 18 },
  },
  
  // Polygon
  polygon: {
    chainId: "0x89",
    name: "Polygon Mainnet",
    icon: "◆",
    rpcUrls: ["https://polygon-rpc.com"],
    blockExplorerUrls: ["https://polygonscan.com"],
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
  },
  polygonAmoy: {
    chainId: "0x13882",
    name: "Polygon Amoy",
    icon: "◆",
    rpcUrls: ["https://rpc-amoy.polygon.technology"],
    blockExplorerUrls: ["https://amoy.polygonscan.com"],
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
  },
  
  // Arbitrum
  arbitrum: {
    chainId: "0xa4b1",
    name: "Arbitrum One",
    icon: "◗",
    rpcUrls: ["https://arb1.arbitrum.io/rpc"],
    blockExplorerUrls: ["https://arbiscan.io"],
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
  arbitrumSepolia: {
    chainId: "0x66eee",
    name: "Arbitrum Sepolia",
    icon: "◗",
    rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc"],
    blockExplorerUrls: ["https://sepolia.arbiscan.io"],
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
  
  // Optimism
  optimism: {
    chainId: "0xa",
    name: "Optimism Mainnet",
    icon: "🔴",
    rpcUrls: ["https://mainnet.optimism.io"],
    blockExplorerUrls: ["https://optimistic.etherscan.io"],
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
  optimismSepolia: {
    chainId: "0xaa37dc",
    name: "Optimism Sepolia",
    icon: "🔴",
    rpcUrls: ["https://sepolia.optimism.io"],
    blockExplorerUrls: ["https://sepolia-optimism.etherscan.io"],
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
  
  // Avalanche
  avalanche: {
    chainId: "0xa86a",
    name: "Avalanche C-Chain",
    icon: "🔺",
    rpcUrls: ["https://api.avax.network/ext/bc/C/rpc"],
    blockExplorerUrls: ["https://snowtrace.io"],
    nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
  },
  avalancheFuji: {
    chainId: "0xa869",
    name: "Avalanche Fuji",
    icon: "🔺",
    rpcUrls: ["https://api.avax-test.network/ext/bc/C/rpc"],
    blockExplorerUrls: ["https://testnet.snowtrace.io"],
    nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
  },
};

export default function AbiDynamicUI() {
  // Provider and signer maintain connection state, will be fetched real-time in callFunction
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<Signer | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);

  // Debug: log connection state
  console.log('🔍 Current connection state:', { hasProvider: !!provider, hasSigner: !!signer, account, chainId });

  const [abiText, setAbiText] = useState<string>("[]");
  const [contractAddress, setContractAddress] = useState<string>("");
  const [abi, setAbi] = useState<AbiItem[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  // Parameter state for each function call, key: functionName#idx or functionSignature
  const [paramsState, setParamsState] = useState<Record<string, string>>({});

  const [logs, setLogs] = useState<string[]>([]);
  
  // Prevent duplicate auto-reconnection
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Restore wallet connection from localStorage on page load
  useEffect(() => {
    const savedAccount = localStorage.getItem('wallet_account');
    
    if (savedAccount && window.ethereum) {
      console.log('💾 Detected saved account, preparing to verify and restore...');
      
      // Wait a moment for MetaMask to initialize, then verify
      const timer = setTimeout(() => {
        reconnectWallet().catch((error) => {
          console.error('❌ Auto-reconnect failed:', error);
          // Verification failed, clear saved state
          localStorage.removeItem('wallet_account');
          localStorage.removeItem('wallet_chainId');
          // Don't show toast, fail silently
          console.log('⚠️ Please manually reconnect wallet');
        });
      }, 800); // 800ms is a balance: gives MetaMask time to init without making user wait too long
      
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Account change handler - use useCallback to avoid closure issues
  const handleAccountsChanged = useCallback((...args: unknown[]) => {
    const accounts = args[0] as string[];
    console.log('🔔🔔🔔 accountsChanged triggered!!!', accounts);
    console.log('Account count:', accounts.length);
    console.log('First account:', accounts[0]);
    
    const newAccount = accounts[0] ?? null;
    
    if (newAccount) {
      console.log('🔄 Starting account switch to:', newAccount);
      
      // Async processing
      setTimeout(async () => {
        try {
          if (!window.ethereum) return;
          
          const web3Provider = new BrowserProvider(window.ethereum);
          const s = await web3Provider.getSigner();
          const addr = await s.getAddress();
          
          console.log('✅ New signer address:', addr);
          
          setProvider(web3Provider);
          setSigner(s);
          setAccount(addr);
          
          const network = await web3Provider.getNetwork();
          const hexChainId = `0x${network.chainId.toString(16)}`;
          setChainId(hexChainId);
          
          localStorage.setItem('wallet_account', addr);
          localStorage.setItem('wallet_chainId', hexChainId);
          
          toast.success(`Switched to ${addr.slice(0, 6)}...${addr.slice(-4)}`, {
            icon: '🔄',
            duration: 3000
          });
          console.log('✅ Account switch completed!');
        } catch (error) {
          console.error('❌ Account switch failed:', error);
          toast.error('Account switch failed');
        }
      }, 100);
    } else {
      console.log('⚠️ Account disconnected');
      setProvider(null);
      setSigner(null);
      setAccount(null);
      setChainId(null);
      localStorage.clear();
      toast.error('Account disconnected');
    }
  }, []); // Empty dependency array, all setState functions are stable
  
  // Chain change handler - use useCallback to avoid closure issues
  const handleChainChanged = useCallback((...args: unknown[]) => {
    const chainId = args[0] as string;
    console.log('🔔 chainChanged triggered! chainId:', chainId);
    setChainId(chainId);
    localStorage.setItem('wallet_chainId', chainId);
    toast.success(`Switched to chain ${chainId}`, { duration: 2000 });
    
    // Re-fetch signer
    if (window.ethereum) {
      setTimeout(async () => {
        try {
          const web3Provider = new BrowserProvider(window.ethereum!);
          const s = await web3Provider.getSigner();
          setProvider(web3Provider);
          setSigner(s);
          console.log('✅ Provider updated');
        } catch (err) {
          console.error('❌ Provider update failed:', err);
        }
      }, 100);
    }
  }, []); // Empty dependency array, all setState functions are stable

  // Initialize window.ethereum event listeners - use persistence strategy
  useEffect(() => {
    console.log('🎯 [New Version] Registering MetaMask event listeners...');
    
    let handlers: { accountsHandler: (...args: unknown[]) => void; chainHandler: (...args: unknown[]) => void } | null = null;
    let checkInterval: NodeJS.Timeout | null = null;
    
    // Use arrow function wrapper to avoid closure issues
    const accountsHandler = (...args: unknown[]) => {
      console.log('🔔🔔🔔 accountsChanged triggered!!!', args);
      handleAccountsChanged(...args);
    };
    
    const chainHandler = (...args: unknown[]) => {
      console.log('🔔 chainChanged triggered! chainId:', args);
      handleChainChanged(...args);
    };
    
    // Function to register listeners
    const registerListeners = () => {
      if (!window.ethereum) {
        console.log('❌ window.ethereum does not exist');
        return false;
      }
      
      // Check if already registered (avoid duplicate registration)
      const events = (window.ethereum as { _events?: Record<string, unknown[]> })._events;
      // @ts-expect-error - accessing internal MetaMask events
      const hasAccountsListener = events?.accountsChanged?.length > 0;
      
      if (hasAccountsListener) {
        console.log('✓ Listener already exists, skip registration');
        return true;
      }
      
      console.log('📌 Registering listeners...');
      window.ethereum.on('accountsChanged', accountsHandler);
      window.ethereum.on('chainChanged', chainHandler);
      console.log('✅ Listener registration completed!');
      
      // Verify registration
      const newEvents = (window.ethereum as { _events?: unknown })._events;
      console.log('🔍 Verify: window.ethereum._events =', newEvents);
      
      return true;
    };
    
    // Initial registration
    const timer = setTimeout(() => {
      if (registerListeners()) {
        handlers = { accountsHandler, chainHandler };
        
        // Check every 5 seconds if listeners are still there
        checkInterval = setInterval(() => {
          if (!window.ethereum) return;
          
          const events = (window.ethereum as { _events?: Record<string, unknown[]> })._events;
          const hasListeners = events && typeof events.accountsChanged !== 'undefined';
          
          if (!hasListeners) {
            console.warn('⚠️ Detected listener loss, re-registering...');
            registerListeners();
          }
        }, 5000);
      }
      
      // Initial account fetch
      if (window.ethereum) {
        window.ethereum.request({ method: "eth_accounts" })
        // @ts-expect-error - eth_accounts returns string[]
        .then((accounts: string[]) => {
            if (accounts.length > 0) setAccount(accounts[0]);
          })
          .catch(err => console.error('Failed to fetch accounts:', err));
      }
    }, 100);
    
    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up listeners and timers');
      clearTimeout(timer);
      if (checkInterval) clearInterval(checkInterval);
      
      if (window.ethereum && handlers) {
        window.ethereum.removeListener('accountsChanged', handlers.accountsHandler);
        window.ethereum.removeListener('chainChanged', handlers.chainHandler);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array, only execute on mount

  // Reconnect wallet (restore after page refresh)
  async function reconnectWallet() {
    if (isReconnecting) {
      console.log('⏸️ Reconnection task already in progress, skip');
      return;
    }
    
    setIsReconnecting(true);
    
    try {
      console.log('🔄 Starting automatic wallet reconnection...');
      
      if (!window.ethereum) {
        console.log('❌ MetaMask not detected');
        return;
      }
      
      const web3Provider = new BrowserProvider(window.ethereum);
      console.log('✅ BrowserProvider created successfully');
      
      // Add timeout mechanism to prevent request hang
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Account fetch timeout')), 10000);
      });
      
      // Get connected account list (no popup)
      console.log('⏳ Fetching account list...');
      const accounts = await Promise.race([
        web3Provider.send("eth_accounts", []) as Promise<string[]>,
        timeoutPromise
      ]);
      console.log('📋 Account list retrieved:', accounts);
      
      if (!accounts || accounts.length === 0) {
        console.log('⚠️ No connected accounts');
        return;
      }
      
      console.log('🔑 Getting signer...');
      const s = await web3Provider.getSigner();
      const addr = await s.getAddress();
      console.log('✅ Signer retrieved successfully, address:', addr);
      
      console.log('🌐 Getting network info...');
      const network = await web3Provider.getNetwork();
      const hexChainId = `0x${network.chainId.toString(16)}`;
      console.log('✅ Network info retrieved successfully, chain ID:', hexChainId);
      
      // Update state
      setProvider(web3Provider);
      setSigner(s);
      setAccount(addr);
      setChainId(hexChainId);
      
      // Update localStorage
      localStorage.setItem('wallet_account', addr);
      localStorage.setItem('wallet_chainId', hexChainId);
      
      // Show success toast
      pushLog(`Auto-restore connection successful: ${addr}`);
      toast.success('Wallet connection auto-restored', { icon: '🦊', duration: 2000 });
      console.log('🎉 Auto-reconnect successful!');
    } catch (error) {
      console.error('❌ Error during auto-reconnect:', error);
      throw error;
    } finally {
      setIsReconnecting(false);
      console.log('🔓 Reconnect state reset');
    }
  }

  // Connect to MetaMask
  async function connectWallet() {
    const toastId = toast.loading('Connecting wallet...');
    try {
      if (!window.ethereum) {
        throw new Error("MetaMask or compatible wallet not detected");
      }
      const web3Provider = new BrowserProvider(window.ethereum);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      await window.ethereum.request({ method: "eth_accounts"});
      console.log('📋 Account list retrieved:', accounts);
      const s = await web3Provider.getSigner();
      const addr = await s.getAddress();
      setProvider(web3Provider);
      setSigner(s);
      setAccount(addr);
      const network = await web3Provider.getNetwork();
      const hexChainId = `0x${network.chainId.toString(16)}`;
      setChainId(hexChainId);
      
      // Save to localStorage
      localStorage.setItem('wallet_account', addr);
      localStorage.setItem('wallet_chainId', hexChainId);
      
      pushLog(`Connected: ${addr}`);
      toast.success(`Wallet connected successfully`, { id: toastId, icon: '✅' });
    } catch (e) {
      const error = e as Error;
      pushLog(`Connection failed: ${error.message || String(e)}`);
      toast.error(`Connection failed: ${error.message}`, { id: toastId });
    }
  }

  // Disconnect (local state cleanup only)
  function disconnect() {
    // Confirmation dialog
    const confirmed = window.confirm('Are you sure you want to disconnect the wallet?');
    if (!confirmed) {
      return;
    }
    
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setChainId(null);
    
    // Clear localStorage
    localStorage.removeItem('wallet_account');
    localStorage.removeItem('wallet_chainId');
    
    pushLog("Local connection disconnected");
    toast.success('Wallet disconnected', { icon: '👋' });
  }

  

  // Sign random string
  async function signRandom() {
    const toastId = toast.loading('Requesting signature...');
    try {
      if (!signer) throw new Error("Please connect wallet first");
      const random = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const sig = await signer.signMessage(random);
      pushLog(`Random string: ${random}`);
      pushLog(`Signature: ${sig}`);
      toast.success('Signature successful!', { id: toastId, icon: '✍️' });
    } catch (e) {
      const error = e as Error;
      pushLog(`Signature failed: ${error.message || String(e)}`);
      toast.error(`Signature failed: ${error.message}`, { id: toastId });
    }
  }

  // Switch chain
  async function switchChain(target: ChainConfig) {
    const toastId = toast.loading(`Switching to ${target.name}...`);
    try {
      if (!window.ethereum) throw new Error("Wallet not detected");
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: target.chainId }],
      });
      pushLog(`Requested switch to ${target.name} (${target.chainId})`);
      toast.success(`Successfully switched to ${target.name}`, { id: toastId, icon: '🔗' });
    } catch (e: unknown) {
      const error = e as { code?: number; message?: string };
      
      // Error code 4902 means the chain is not added to MetaMask
      if (error.code === 4902) {
        try {
          toast.loading(`Adding ${target.name} to wallet...`, { id: toastId });
          
          // Add new network
          await window.ethereum!.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: target.chainId,
                chainName: target.name,
                rpcUrls: target.rpcUrls,
                nativeCurrency: target.nativeCurrency,
                blockExplorerUrls: target.blockExplorerUrls,
              },
            ],
          });
          
          pushLog(`Added and switched to ${target.name}`);
          toast.success(`Successfully added ${target.name}!`, { id: toastId, icon: '✨' });
        } catch (addError) {
          const err = addError as Error;
          pushLog(`Failed to add network: ${err.message || String(addError)}`);
          toast.error(`Add failed: ${err.message}`, { id: toastId });
        }
      } else {
        // Other errors (user rejected, etc.)
        const errMsg = error.message || String(e);
        pushLog(`Chain switch failed: ${errMsg}`);
        toast.error(`Switch failed: ${errMsg}`, { id: toastId });
      }
    }
  }

  // Parse ABI
  function tryParseAbi() {
    const toastId = toast.loading('Parsing ABI...');
    try {
      const cleanText = abiText.replace(/,\s*([\]}])/g, '$1')
      const parsed = JSON.parse(cleanText);
      if (!Array.isArray(parsed)) throw new Error("ABI is not an array");
      setAbi(parsed as AbiItem[]);
      setParseError(null);
      pushLog("ABI parsed successfully");
      toast.success(`Parsed successfully! Identified ${(parsed as AbiItem[]).filter(a => a.type === 'function').length} functions`, { 
        id: toastId, 
        icon: '📄',
        duration: 3000 
      });
    } catch (e) {
      const error = e as Error;
      setParseError(error.message || String(e));
      setAbi([]);
      pushLog(`ABI parsing failed: ${error.message || String(e)}`);
      toast.error(`Parse failed: ${error.message}`, { id: toastId });
    }
  }

  // Filter function items from abi
  const functions = useMemo(() => abi.filter((a) => a.type === "function"), [abi]);

  // Construct key from function and parameters
  function getFnKey(fn: AbiItem) {
    const name = fn.name || "";
    const types = (fn.inputs || []).map((i) => i.type).join(",");
    return `${name}(${types})`;
  }

  // Update a parameter value
  function updateParam(fnKey: string, idx: number, value: string) {
    const key = `${fnKey}#${idx}`;
    setParamsState((s) => ({ ...s, [key]: value }));
  }

  // Get value from paramsState and try to convert to appropriate type
  function parseParamValue(type: string, raw: string, paramName?: string): string | boolean {
    // Only supports basic types, arrays/structs not supported
    if (type.startsWith("uint") || type.startsWith("int")) {
      // Support decimal number input
      if (raw.trim() === "") throw new Error("Empty value");
      
      // Check if it's an amount/value type parameter, if so auto multiply by decimals
      const isAmountParam = paramName && (
        paramName.toLowerCase().includes('amount') ||
        paramName.toLowerCase().includes('value') ||
        paramName.toLowerCase() === 'wad' ||
        paramName.toLowerCase().includes('qty') ||
        paramName.toLowerCase().includes('quantity')
      );
      
      if (isAmountParam) {
        // If input contains decimal point, it's human-readable format, needs conversion
        if (raw.includes('.') || (parseFloat(raw) < 1000000 && parseFloat(raw) > 0)) {
          const decimals = contractAddress.toLowerCase() === "0xdac17f958d2ee523a2206206994597c13d831ec7" ? 6 : 18;
          const numValue = parseFloat(raw);
          const bigIntValue = BigInt(Math.floor(numValue * Math.pow(10, decimals)));
          console.log(`💰 ${paramName} Smart conversion: ${raw} → ${bigIntValue.toString()} (decimals: ${decimals})`);
          return bigIntValue.toString();
        }
      }
      
      // Can also use BigNumber, but ethers auto-handles number strings
      return raw;
    }
    if (type === "address") {
      return raw;
    }
    if (type === "bool") {
      const v = raw.toLowerCase();
      return v === "true" || v === "1" || v === "yes";
    }
    if (type === "string") return raw;
    if (type.startsWith("bytes")) return raw; // User needs to pass hex or string
    // fallback
    return raw;
  }

  // Execute function (call or send)
  async function callFunction(fn: AbiItem) {
    const isReadOnly = fn.stateMutability === "view" || fn.stateMutability === "pure";
    const toastId = toast.loading(isReadOnly ? `Querying ${fn.name}...` : `Sending transaction ${fn.name}...`);
    
    try {
      if (!window.ethereum) throw new Error("Please install MetaMask first");
      if (!account) throw new Error("Please connect wallet first");
      if (!contractAddress) throw new Error("Please enter contract address");
      
      // Re-fetch latest provider and signer to ensure using current network
      console.log('🔄 Refreshing provider to ensure current network...');
      const currentProvider = new BrowserProvider(window.ethereum);
      const currentSigner = await currentProvider.getSigner();
      console.log('✅ Provider updated to current network');
      
      const fnKey = getFnKey(fn);
      const inputs = fn.inputs || [];
      const args = inputs.map((input, idx) => {
        const key = `${fnKey}#${idx}`;
        const raw = paramsState[key] ?? "";
        return parseParamValue(input.type, raw, input.name);
      });

      const contract = new Contract(contractAddress, abi, isReadOnly ? currentProvider : currentSigner);

      // view/pure -> call
      if (isReadOnly) {
        const functionFragment = contract.getFunction(fn.name!);
        const res = await functionFragment(...args);
        const result = stringifyResult(res, fn.name);
        pushLog(`Function ${fn.name} result: ${result}`);
        toast.success(`Query success! Result: ${result.length > 50 ? result.slice(0, 50) + '...' : result}`, { 
          id: toastId, 
          icon: '📖',
          duration: 4000 
        });
      } else {
        // non-view -> send transaction
        const functionFragment = contract.getFunction(fn.name!);
        
        toast.loading('Waiting for user confirmation...', { id: toastId });
        const txResp = await functionFragment(...args);
        
        pushLog(`Transaction sent, txHash: ${txResp.hash}`);
        toast.loading(`Transaction sent, waiting for confirmation... (${txResp.hash.slice(0, 10)}...)`, { id: toastId });
        
        // Wait for 1 confirmation
        const receipt = await txResp.wait(1);
        pushLog(`Transaction confirmed: blockNumber=${receipt?.blockNumber}, status=${receipt?.status}`);
        
        toast.success(`Transaction successful!`, { 
          id: toastId, 
          icon: '🚀',
          duration: 5000 
        });
      }
    } catch (e) {
      const error = e as Error;
      pushLog(`Call failed: ${error.message || String(e)}`);
      
      // Show different prompts based on error type
      if (error.message.includes('user rejected') || error.message.includes('User denied')) {
        toast.error('User cancelled transaction', { id: toastId, icon: '🚫' });
      } else if (error.message.includes('insufficient funds')) {
        toast.error('Insufficient funds', { id: toastId, icon: '💸' });
      } else if (error.message.includes('network changed') || error.message.includes('NETWORK_ERROR')) {
        toast.error('Network changed, please retry', { id: toastId, icon: '🔄' });
      } else if (error.message.includes('wrong network') || error.message.includes('chain mismatch')) {
        toast.error('Contract not on current network, please switch', { id: toastId, icon: '⚠️' });
      } else {
        // Extract useful error info
        const errorMsg = error.message.split('\n')[0]; // Only first line
        toast.error(`Call failed: ${errorMsg.length > 100 ? errorMsg.slice(0, 100) + '...' : errorMsg}`, { 
          id: toastId,
          duration: 5000 
        });
      }
    }
  }

  function stringifyResult(res: unknown, functionName?: string): string {
    console.log('stringifyResult', res, functionName);
    try {
      // Handle arrays
      if (Array.isArray(res)) {
        return JSON.stringify(res.map((r) => stringifyResult(r, functionName)));
      }
      
      // Determine decimals based on contract address
      const getDecimals = () => {
        // USDT uses 6 decimals
        if (contractAddress.toLowerCase() === "0xdac17f958d2ee523a2206206994597c13d831ec7") {
          return 6;
        }
        // Other ERC20 tokens default to 18 decimals
        return 18;
      };
      
      // Handle BigInt
      if (typeof res === "bigint") {
        const rawValue = res.toString();
        // If balance-related function, show converted value
        if (functionName && (
          functionName.toLowerCase().includes('balance') || 
          functionName.toLowerCase().includes('supply')
        )) {
          const decimals = getDecimals();
          const converted = Number(res) / Math.pow(10, decimals);
          return `${converted.toLocaleString('en-US', { maximumFractionDigits: 6 })} (raw: ${rawValue})`;
        }
        return rawValue;
      }
      
      // Handle objects (including BigNumber)
      if (res && typeof res === "object") {
        if ("_isBigNumber" in res || "toString" in res) {
          const rawValue = (res as { toString: () => string }).toString();
          // If balance-related function, show converted value
          if (functionName && (
            functionName.toLowerCase().includes('balance') || 
            functionName.toLowerCase().includes('supply')
          )) {
            const decimals = getDecimals();
            const converted = Number(rawValue) / Math.pow(10, decimals);
            return `${converted.toLocaleString('en-US', { maximumFractionDigits: 6 })} (raw: ${rawValue})`;
          }
          return rawValue;
        }
        // Receipt-like
        return JSON.stringify(res, (_, value) => 
          typeof value === "bigint" ? value.toString() : value
        );
      }
      
      return String(res);
    } catch {
      return String(res);
    }
  }

  function pushLog(msg: string) {
    setLogs((l) => [new Date().toLocaleString() + " - " + msg, ...l].slice(0, 200));
  }

  return (
    <>
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
            borderRadius: '10px',
            padding: '16px',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
          loading: {
            iconTheme: {
              primary: '#3b82f6',
              secondary: '#fff',
            },
          },
        }}
      />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">

        {/* Wallet Connection Area */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl p-6 mb-8 border border-white/60">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-[200px]">
              <div className="flex gap-3">
                <button
                  className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white font-bold shadow-lg hover:shadow-xl transition-shadow duration-300 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={connectWallet}
                  disabled={!!account}
                >
                  <span className="text-2xl">🦊</span>
                  <span>{account ? "Connected" : "Connect Wallet"}</span>
                </button>
                {account && (
                  <button 
                    className="px-4 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-all duration-200 hover:scale-105 transform" 
                    onClick={disconnect}
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </div>
            
            <button 
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transform transition-all duration-300 flex items-center gap-2"
              onClick={signRandom}
              disabled={!account}
            >
              <span className="text-xl">✍️</span>
              <span>Sign Test</span>
            </button>

            {account && (
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 px-6 py-3 rounded-xl border-2 border-indigo-200 shadow-md">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Connected</span>
                </div>
                <div className="text-sm font-mono font-bold text-indigo-900">
                  {account.slice(0, 6)}...{account.slice(-4)}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  Chain ID: <span className="font-semibold text-indigo-600">{chainId ?? "-"}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ABI Configuration Area */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 md:p-8 mb-8 border border-gray-100">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* ABI Input */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <label className="flex items-center gap-2 font-bold text-gray-800 text-xl">
                  <span className="text-2xl">📄</span>
                  <span>ABI JSON</span>
                </label>
                <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-semibold">
                  Required
                </span>
              </div>
              <textarea
                rows={14}
                value={abiText}
                onChange={(e) => setAbiText(e.target.value)}
                className="w-full border-2 border-gray-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 p-4 rounded-xl font-mono text-sm transition-all duration-200 resize-none bg-gray-50 hover:bg-white shadow-inner"
                placeholder='Paste contract ABI JSON array...'
              />
              <div className="flex flex-wrap gap-3 mt-4">
                <button 
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transform transition-all duration-300 flex items-center gap-2" 
                  onClick={tryParseAbi}
                >
                  <span>🔍</span>
                  <span>Parse ABI</span>
                </button>
                <button
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transform transition-all duration-300 flex items-center gap-2"
                  onClick={() => {
                    const sampleAbi = getSampleAbi();
                    setAbiText(JSON.stringify(sampleAbi, null, 2));
                    setContractAddress("0x779877A7B0D9E8603169DdbD7836e478b4624789");
                    switchChain(CHAIN_MAP.sepolia);
                    
                    // Auto-fill balanceOf parameter
                    setTimeout(() => {
                      setParamsState({
                        'balanceOf(address)#0': '0x4281eCF07378Ee595C564a59048801330f3084eE'
                      });
                    }, 100);
                    
                    toast.success('LINK contract example loaded with test address', { 
                      icon: '🔗',
                      duration: 3000 
                    });
                  }}
                >
                  <span>🔗</span>
                  <span>LINK Example (Sepolia Testnet)</span>
                </button>
              
                
                <button
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transform transition-all duration-300 flex items-center gap-2"
                  onClick={() => {
                    const usdtAbi = getUsdtMainnetAbi();
                    setAbiText(JSON.stringify(usdtAbi, null, 2));
                    setContractAddress("0xdAC17F958D2ee523a2206206994597C13D831ec7");
                    switchChain(CHAIN_MAP.ethereum);
                    // Auto-fill balanceOf parameter - Vitalik's address
                    setTimeout(() => {
                      setParamsState({
                        'balanceOf(address)#0': '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
                      });
                    }, 100);
                    toast.success('USDT mainnet contract example loaded (Vitalik address)', { 
                      icon: '💵',
                      duration: 3000 
                    });
                  }}
                >
                  <span>💵</span>
                  <span>USDT Example (Mainnet)</span>
                </button>
              </div>
              {parseError && (
                <div className="mt-4 p-4 bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-300 rounded-xl text-red-800 text-sm shadow-md animate-shake">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">❌</span>
                    <div>
                      <div className="font-bold mb-1">Parse Error</div>
                      <div className="text-red-700">{parseError}</div>
                    </div>
                  </div>
                </div>
              )}
              {abi.length > 0 && !parseError && (
                <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl shadow-md">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">✅</span>
                    <div className="flex-1">
                      <div className="font-bold text-green-800">Parse Successful!</div>
                      <div className="text-green-700 text-sm">Identified <span className="font-bold text-lg">{functions.length}</span> functions</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Side Configuration */}
            <div className="space-y-6">
              {/* Contract Address */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="flex items-center gap-2 font-bold text-gray-800 text-xl">
                    <span className="text-2xl">📍</span>
                    <span>Contract Address</span>
                  </label>
                  <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-semibold">
                    Required
                  </span>
                </div>
                <input
                  className="w-full border-2 border-gray-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 p-4 rounded-xl font-mono text-sm transition-all duration-200 bg-gray-50 hover:bg-white shadow-inner"
                  value={contractAddress}
                  onChange={(e) => setContractAddress(e.target.value)}
                  placeholder="0x..."
                />
                {contractAddress === "0x779877A7B0D9E8603169DdbD7836e478b4624789" && (
                  <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-700">
                    <div className="font-bold">💡 Info</div>
                    <div>LINK test token contract (<span className="font-bold">Sepolia Testnet</span>)</div>
                  </div>
                )}
                {contractAddress === "0xdAC17F958D2ee523a2206206994597C13D831ec7" && (
                  <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
                    <div className="font-bold flex items-center gap-2">
                      <span>💡</span>
                      <span>Info</span>
                    </div>
                    <div className="mt-1 space-y-1">
                      <div>• USDT stablecoin contract (<span className="font-bold">Ethereum Mainnet</span>)</div>
                      <div>• Querying <span className="font-bold">Vitalik Buterin</span>'s wallet</div>
                      <div>• USDT decimals: <span className="font-bold">6</span> (auto-detected)</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Switch Chain */}
              <div>
                <label className="flex items-center gap-2 font-bold text-gray-800 text-xl mb-4">
                  <span className="text-2xl">🔗</span>
                  <span>Switch Network</span>
                </label>
                <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                  {Object.entries(CHAIN_MAP).map(([k, v]) => (
                    <button
                      key={k}
                      className="px-4 py-3 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 hover:from-indigo-50 hover:to-purple-50 border-2 border-slate-200 hover:border-indigo-300 text-sm font-bold text-gray-700 hover:text-indigo-700 transition-all duration-200 text-left hover:scale-102 transform hover:shadow-md flex items-center gap-3"
                      onClick={() => switchChain(v)}
                    >
                      <span className="text-lg">{v.icon}</span>
                      <span>{v.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Function Call Area */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 md:p-8 mb-8 border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-4xl">⚡</span>
            <h2 className="text-3xl font-black text-gray-800">Smart Contract Functions</h2>
            {functions.length > 0 && (
              <span className="ml-auto bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
                {functions.length} functions
              </span>
            )}
          </div>
          
          {functions.length === 0 && (
            <div className="text-center py-20 bg-gradient-to-br from-gray-50 to-slate-100 rounded-2xl border-2 border-dashed border-gray-300">
              <div className="text-7xl mb-6 animate-bounce">📭</div>
              <div className="text-xl font-bold text-gray-400 mb-2">No Functions</div>
              <div className="text-gray-500">Please parse ABI first to generate function call interface</div>
            </div>
          )}

          <div className="space-y-4">
            {functions.map((fn) => {
              const fnKey = getFnKey(fn);
              const isReadOnly = fn.stateMutability === "view" || fn.stateMutability === "pure";
              return (
                <div key={fnKey} className="border-2 border-gray-200 rounded-2xl p-6 hover:border-indigo-400 hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/30">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                    <div className="flex-1 min-w-[200px]">
                      <div className="text-2xl font-black text-gray-900 mb-2">{fn.name}</div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`text-xs px-4 py-1.5 rounded-full font-bold shadow-sm ${
                          isReadOnly 
                            ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white" 
                            : "bg-gradient-to-r from-orange-500 to-red-500 text-white"
                        }`}>
                          {isReadOnly ? "🔍 Read" : "✍️ Write"} · {fn.stateMutability ?? "nonpayable"}
                        </span>
                        {fn.outputs && fn.outputs.length > 0 && (
                          <span className="text-xs px-4 py-1.5 rounded-full font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm">
                            📤 {fn.outputs.map((o) => o.type).join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      className={`px-8 py-3 rounded-xl font-bold shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-110 transform ${
                        isReadOnly
                          ? "bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600 hover:from-blue-700 hover:via-blue-800 hover:to-cyan-700 text-white"
                          : "bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 hover:from-orange-700 hover:via-red-700 hover:to-pink-700 text-white"
                      }`}
                      onClick={() => callFunction(fn)}
                    >
                      {isReadOnly ? "📖 Call Query" : "🚀 Send Transaction"}
                    </button>
                  </div>

                  {(fn.inputs || []).length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white/60 rounded-xl border border-gray-200">
                      {(fn.inputs || []).map((inp, idx) => {
                        const key = `${fnKey}#${idx}`;
                        return (
                          <div key={key}>
                            <label className="block text-sm font-bold text-gray-800 mb-2">
                              {inp.name || `Param ${idx + 1}`}
                              <span className="text-xs font-semibold text-indigo-600 ml-2 px-2 py-1 bg-indigo-100 rounded-md">
                                {inp.type}
                              </span>
                            </label>
                            <input
                              className="w-full border-2 border-gray-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 p-3 rounded-xl font-mono text-sm transition-all duration-200 bg-white shadow-sm hover:shadow-md"
                              placeholder={placeholderForType(inp.type)}
                              value={paramsState[key] ?? ""}
                              onChange={(e) => updateParam(fnKey, idx, e.target.value)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Log Output Area */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 md:p-8 border border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="text-4xl">📊</span>
              <h2 className="text-3xl font-black text-gray-800">Execution Logs</h2>
              {logs.length > 0 && (
                <span className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                  {logs.length} logs
                </span>
              )}
            </div>
            <button 
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold text-sm transition-all duration-300 hover:scale-105 transform shadow-lg hover:shadow-xl flex items-center gap-2"
              onClick={() => setLogs([])}
              disabled={logs.length === 0}
            >
              <span>🗑️</span>
              <span>Clear Logs</span>
            </button>
          </div>
          <div className="relative">
            <div className="h-96 overflow-auto border-2 border-gray-300 rounded-2xl p-5 bg-gradient-to-br from-slate-900 via-gray-900 to-black text-green-400 text-sm font-mono shadow-2xl">
              {logs.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-gray-600">
                  <div className="text-5xl mb-4">💻</div>
                  <div className="text-lg font-bold">No Logs Yet</div>
                  <div className="text-xs mt-2">Logs will appear here after executing functions</div>
                </div>
              )}
              {logs.map((l, i) => (
                <div 
                  key={i} 
                  className="mb-3 p-3 hover:bg-slate-800/50 rounded-lg transition-all duration-200 border-l-4 border-green-500/50 hover:border-green-400 bg-slate-900/30"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-green-500 font-bold shrink-0">&gt;</span>
                    <span className="break-all">{l}</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Terminal Decoration */}
            <div className="absolute top-0 left-0 right-0 h-8 bg-gray-800 rounded-t-2xl flex items-center px-4 gap-2 border-b-2 border-gray-700">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="ml-3 text-xs text-gray-400 font-semibold">Terminal Output</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

// ---------- Helper Functions ----------

function placeholderForType(t: string) {
  if (t.startsWith("uint") || t.startsWith("int")) return "e.g.: 123 or 1000000000000000000";
  if (t === "address") return "e.g.: 0xabc...";
  if (t === "bool") return "true / false";
  if (t === "string") return "any text";
  if (t.startsWith("bytes")) return "hex or text";
  return "enter value";
}

function getUsdtMainnetAbi(): AbiItem[] {
  // USDT (Tether) ERC20 contract ABI example
  // Contract address (Ethereum Mainnet): 0xdAC17F958D2ee523a2206206994597C13D831ec7
  // https://etherscan.io/token/0xdac17f958d2ee523a2206206994597c13d831ec7?a=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
  return [
    {
      "type": "function",
      "name": "name",
      "inputs": [],
      "outputs": [{ "name": "", "type": "string", "internalType": "string" }],
      "stateMutability": "view",
    },
    {
      "type": "function",
      "name": "symbol",
      "inputs": [],
      "outputs": [{ "name": "", "type": "string", "internalType": "string" }],
      "stateMutability": "view",
    },
    {
      "type": "function",
      "name": "decimals",
      "inputs": [],
      "outputs": [{ "name": "", "type": "uint8", "internalType": "uint8" }],
      "stateMutability": "view",
    },
    {
      "type": "function",
      "name": "totalSupply",
      "inputs": [],
      "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
      "stateMutability": "view",
    },
    {
      "type": "function",
      "name": "balanceOf",
      "inputs": [{ "name": "account", "type": "address", "internalType": "address" }],
      "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
      "stateMutability": "view",
    },
    {
      "type": "function",
      "name": "transfer",
      "inputs": [
        { "name": "recipient", "type": "address", "internalType": "address" },
        { "name": "amount", "type": "uint256", "internalType": "uint256" }
      ],
      "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
      "stateMutability": "nonpayable",
    },
    {
      "type": "function",
      "name": "allowance",
      "inputs": [
        { "name": "owner", "type": "address", "internalType": "address" },
        { "name": "spender", "type": "address", "internalType": "address" }
      ],
      "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
      "stateMutability": "view",
    },
    {
      "type": "function",
      "name": "approve",
      "inputs": [
        { "name": "spender", "type": "address", "internalType": "address" },
        { "name": "amount", "type": "uint256", "internalType": "uint256" }
      ],
      "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
      "stateMutability": "nonpayable",
    },
    {
      "type": "function",
      "name": "transferFrom",
      "inputs": [
        { "name": "sender", "type": "address", "internalType": "address" },
        { "name": "recipient", "type": "address", "internalType": "address" },
        { "name": "amount", "type": "uint256", "internalType": "uint256" }
      ],
      "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
      "stateMutability": "nonpayable",
    },
  ];
}

function getSampleAbi(): AbiItem[] {
  // LINK test token ERC20 contract ABI example
  // Contract address (Sepolia Testnet): 0x779877A7B0D9E8603169DdbD7836e478b4624789
  // This is Chainlink official LINK test token, can be obtained free from faucet
  return [
    {
      "type": "function",
      "name": "name",
      "inputs": [],
      "outputs": [{ "name": "", "type": "string", "internalType": "string" }],
      "stateMutability": "view",
    },
    {
      "type": "function",
      "name": "symbol",
      "inputs": [],
      "outputs": [{ "name": "", "type": "string", "internalType": "string" }],
      "stateMutability": "view",
    },
    {
      "type": "function",
      "name": "decimals",
      "inputs": [],
      "outputs": [{ "name": "", "type": "uint8", "internalType": "uint8" }],
      "stateMutability": "view",
    },
    {
      "type": "function",
      "name": "totalSupply",
      "inputs": [],
      "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
      "stateMutability": "view",
    },
    {
      "type": "function",
      "name": "balanceOf",
      "inputs": [{ "name": "account", "type": "address", "internalType": "address" }],
      "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
      "stateMutability": "view",
    },
    {
      "type": "function",
      "name": "transfer",
      "inputs": [
        { "name": "recipient", "type": "address", "internalType": "address" },
        { "name": "amount", "type": "uint256", "internalType": "uint256" }
      ],
      "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
      "stateMutability": "nonpayable",
    },
    {
      "type": "function",
      "name": "allowance",
      "inputs": [
        { "name": "owner", "type": "address", "internalType": "address" },
        { "name": "spender", "type": "address", "internalType": "address" }
      ],
      "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
      "stateMutability": "view",
    },
    {
      "type": "function",
      "name": "approve",
      "inputs": [
        { "name": "spender", "type": "address", "internalType": "address" },
        { "name": "amount", "type": "uint256", "internalType": "uint256" }
      ],
      "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
      "stateMutability": "nonpayable",
    },
    {
      "type": "function",
      "name": "transferFrom",
      "inputs": [
        { "name": "sender", "type": "address", "internalType": "address" },
        { "name": "recipient", "type": "address", "internalType": "address" },
        { "name": "amount", "type": "uint256", "internalType": "uint256" }
      ],
      "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
      "stateMutability": "nonpayable",
    },
  ];
}
