import { useEffect, useMemo, useState, useCallback } from "react";
import { BrowserProvider, Contract, type Signer } from "ethers";
import toast, { Toaster } from "react-hot-toast";
// 单文件 React 组件 (TypeScript)
// 功能：
// 1) 连接 MetaMask
// 2) 使用钱包对随机字符串签名
// 3) 切换链（支持通过链 id 切换到常见以太兼容链）
// 4) 输入 ABI JSON 和合约地址
// 5) 根据 ABI 生成界面（仅支持基本类型：address, uint*, int*, bool, string, bytes）
// 6) 调用合约方法并展示结果（view/pure 直接 call，非 view 发起交易并展示 txHash）

// 使用说明：
// - 需要安装依赖：ethers v6
// - 推荐在已有 React + Tailwind 项目中使用
// - 只作为演示/骨架，可按需扩展（类型校验、数组、struct 等）

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
  // provider 和 signer 用于维护连接状态，在 callFunction 中会实时获取最新值
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<Signer | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);

  // 用于调试：记录连接状态
  console.log('🔍 当前连接状态:', { hasProvider: !!provider, hasSigner: !!signer, account, chainId });

  const [abiText, setAbiText] = useState<string>("[]");
  const [contractAddress, setContractAddress] = useState<string>("");
  const [abi, setAbi] = useState<AbiItem[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  // 每个函数调用的参数状态， key: functionName#idx 或 functionSignature
  const [paramsState, setParamsState] = useState<Record<string, string>>({});

  const [logs, setLogs] = useState<string[]>([]);
  
  // 防止重复自动重连
  const [isReconnecting, setIsReconnecting] = useState(false);

  // 页面加载时从 localStorage 恢复钱包连接
  useEffect(() => {
    const savedAccount = localStorage.getItem('wallet_account');
    
    if (savedAccount && window.ethereum) {
      console.log('💾 检测到保存的账号，准备验证并恢复...');
      
      // 等待一小段时间让 MetaMask 初始化，然后立即验证
      const timer = setTimeout(() => {
        reconnectWallet().catch((error) => {
          console.error('❌ 自动重连失败:', error);
          // 验证失败，清除保存的状态
          localStorage.removeItem('wallet_account');
          localStorage.removeItem('wallet_chainId');
          // 不显示 toast，静默失败
          console.log('⚠️ 请手动重新连接钱包');
        });
      }, 800); // 800ms 是个平衡点：既给 MetaMask 初始化时间，又不让用户等太久
      
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 账户切换处理器 - 使用 useCallback 避免闭包问题
  const handleAccountsChanged = useCallback((...args: unknown[]) => {
    const accounts = args[0] as string[];
    console.log('🔔🔔🔔 accountsChanged 触发！！！', accounts);
    console.log('账户数量:', accounts.length);
    console.log('第一个账户:', accounts[0]);
    
    const newAccount = accounts[0] ?? null;
    
    if (newAccount) {
      console.log('🔄 开始处理账户切换到:', newAccount);
      
      // 异步处理
      setTimeout(async () => {
        try {
          if (!window.ethereum) return;
          
          const web3Provider = new BrowserProvider(window.ethereum);
          const s = await web3Provider.getSigner();
          const addr = await s.getAddress();
          
          console.log('✅ 新 signer 地址:', addr);
          
          setProvider(web3Provider);
          setSigner(s);
          setAccount(addr);
          
          const network = await web3Provider.getNetwork();
          const hexChainId = `0x${network.chainId.toString(16)}`;
          setChainId(hexChainId);
          
          localStorage.setItem('wallet_account', addr);
          localStorage.setItem('wallet_chainId', hexChainId);
          
          toast.success(`已切换到 ${addr.slice(0, 6)}...${addr.slice(-4)}`, {
            icon: '🔄',
            duration: 3000
          });
          console.log('✅ 账户切换完成！');
        } catch (error) {
          console.error('❌ 账户切换失败:', error);
          toast.error('账户切换失败');
        }
      }, 100);
    } else {
      console.log('⚠️ 账户断开');
      setProvider(null);
      setSigner(null);
      setAccount(null);
      setChainId(null);
      localStorage.clear();
      toast.error('账户已断开');
    }
  }, []); // 空依赖数组，因为所有的 setState 函数都是稳定的
  
  // 链切换处理器 - 使用 useCallback 避免闭包问题
  const handleChainChanged = useCallback((...args: unknown[]) => {
    const chainId = args[0] as string;
    console.log('🔔 chainChanged 触发！chainId:', chainId);
    setChainId(chainId);
    localStorage.setItem('wallet_chainId', chainId);
    toast.success(`已切换到链 ${chainId}`, { duration: 2000 });
    
    // 重新获取 signer
    if (window.ethereum) {
      setTimeout(async () => {
        try {
          const web3Provider = new BrowserProvider(window.ethereum!);
          const s = await web3Provider.getSigner();
          setProvider(web3Provider);
          setSigner(s);
          console.log('✅ Provider 已更新');
        } catch (err) {
          console.error('❌ 更新 provider 失败:', err);
        }
      }, 100);
    }
  }, []); // 空依赖数组，因为所有的 setState 函数都是稳定的

  // 初始化 window.ethereum 事件监听器 - 使用持久化策略
  useEffect(() => {
    console.log('🎯 [新版] 正在注册 MetaMask 事件监听器...');
    
    let handlers: { accountsHandler: (...args: unknown[]) => void; chainHandler: (...args: unknown[]) => void } | null = null;
    let checkInterval: NodeJS.Timeout | null = null;
    
    // 使用箭头函数包装，避免闭包问题
    const accountsHandler = (...args: unknown[]) => {
      console.log('🔔🔔🔔 accountsChanged 触发！！！', args);
      handleAccountsChanged(...args);
    };
    
    const chainHandler = (...args: unknown[]) => {
      console.log('🔔 chainChanged 触发！chainId:', args);
      handleChainChanged(...args);
    };
    
    // 注册监听器的函数
    const registerListeners = () => {
      if (!window.ethereum) {
        console.log('❌ window.ethereum 不存在');
        return false;
      }
      
      // 检查是否已经注册（避免重复注册）
      const events = (window.ethereum as { _events?: Record<string, unknown[]> })._events;
      // @ts-ignore
      const hasAccountsListener = events?.accountsChanged?.length > 0;
      
      if (hasAccountsListener) {
        console.log('✓ 监听器已存在，跳过注册');
        return true;
      }
      
      console.log('📌 注册监听器...');
      window.ethereum.on('accountsChanged', accountsHandler);
      window.ethereum.on('chainChanged', chainHandler);
      console.log('✅ 监听器注册完成！');
      
      // 验证注册
      const newEvents = (window.ethereum as { _events?: unknown })._events;
      console.log('🔍 验证: window.ethereum._events =', newEvents);
      
      return true;
    };
    
    // 初始注册
    const timer = setTimeout(() => {
      if (registerListeners()) {
        handlers = { accountsHandler, chainHandler };
        
        // 每 2 秒检查一次监听器是否还在
        checkInterval = setInterval(() => {
          if (!window.ethereum) return;
          
          const events = (window.ethereum as { _events?: Record<string, unknown[]> })._events;
          // @ts-ignore
          const hasListeners = events?.accountsChanged?.length > 0;
          
          if (!hasListeners) {
            console.warn('⚠️ 检测到监听器丢失，重新注册...');
            registerListeners();
          }
        }, 5000);
      }
      
      // 初始获取账户
      if (window.ethereum) {
        window.ethereum.request({ method: "eth_accounts" })
        // @ts-ignore
        .then((accounts: string[]) => {
            if (accounts.length > 0) setAccount(accounts[0]);
          })
          .catch(err => console.error('获取账户失败:', err));
      }
    }, 100);
    
    // 清理函数
    return () => {
      console.log('🧹 清理监听器和定时器');
      clearTimeout(timer);
      if (checkInterval) clearInterval(checkInterval);
      
      if (window.ethereum && handlers) {
        window.ethereum.removeListener('accountsChanged', handlers.accountsHandler);
        window.ethereum.removeListener('chainChanged', handlers.chainHandler);
      }
    };
  }, []); // 空依赖数组，只在挂载时执行一次

  // 重新连接钱包（页面刷新后恢复）
  async function reconnectWallet() {
    if (isReconnecting) {
      console.log('⏸️ 已有重连任务在进行中，跳过');
      return;
    }
    
    setIsReconnecting(true);
    
    try {
      console.log('🔄 开始自动重连钱包...');
      
      if (!window.ethereum) {
        console.log('❌ 未检测到 MetaMask');
        return;
      }
      
      const web3Provider = new BrowserProvider(window.ethereum);
      console.log('✅ BrowserProvider 创建成功');
      
      // 添加超时机制，防止请求挂起
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('获取账号超时')), 10000);
      });
      
      // 获取已连接的账号列表（不会弹窗）
      console.log('⏳ 正在获取账号列表...');
      const accounts = await Promise.race([
        web3Provider.send("eth_accounts", []) as Promise<string[]>,
        timeoutPromise
      ]);
      console.log('📋 获取到的账号列表:', accounts);
      
      if (!accounts || accounts.length === 0) {
        console.log('⚠️ 没有已连接的账号');
        return;
      }
      
      console.log('🔑 开始获取 signer...');
      const s = await web3Provider.getSigner();
      const addr = await s.getAddress();
      console.log('✅ Signer 获取成功，地址:', addr);
      
      console.log('🌐 获取网络信息...');
      const network = await web3Provider.getNetwork();
      const hexChainId = `0x${network.chainId.toString(16)}`;
      console.log('✅ 网络信息获取成功，链 ID:', hexChainId);
      
      // 更新状态
      setProvider(web3Provider);
      setSigner(s);
      setAccount(addr);
      setChainId(hexChainId);
      
      // 更新 localStorage
      localStorage.setItem('wallet_account', addr);
      localStorage.setItem('wallet_chainId', hexChainId);
      
      // 显示成功的 toast
      pushLog(`自动恢复连接成功：${addr}`);
      toast.success('已自动恢复钱包连接', { icon: '🦊', duration: 2000 });
      console.log('🎉 自动重连成功！');
    } catch (error) {
      console.error('❌ 自动重连过程中出错:', error);
      throw error;
    } finally {
      setIsReconnecting(false);
      console.log('🔓 重连状态已重置');
    }
  }

  // 连接 MetaMask
  async function connectWallet() {
    const toastId = toast.loading('正在连接钱包...');
    try {
      if (!window.ethereum) {
        throw new Error("未检测到 MetaMask 或兼容钱包");
      }
      const web3Provider = new BrowserProvider(window.ethereum);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      await window.ethereum.request({ method: "eth_accounts"});
      console.log('📋 获取到的账号列表:', accounts);
      const s = await web3Provider.getSigner();
      const addr = await s.getAddress();
      setProvider(web3Provider);
      setSigner(s);
      setAccount(addr);
      const network = await web3Provider.getNetwork();
      const hexChainId = `0x${network.chainId.toString(16)}`;
      setChainId(hexChainId);
      
      // 保存到 localStorage
      localStorage.setItem('wallet_account', addr);
      localStorage.setItem('wallet_chainId', hexChainId);
      
      pushLog(`已连接：${addr}`);
      toast.success(`成功连接钱包`, { id: toastId, icon: '✅' });
    } catch (e) {
      const error = e as Error;
      pushLog(`连接失败: ${error.message || String(e)}`);
      toast.error(`连接失败: ${error.message}`, { id: toastId });
    }
  }

  // 断开（只是本地状态清理）
  function disconnect() {
    // 确认对话框
    const confirmed = window.confirm('确定要断开钱包连接吗？');
    if (!confirmed) {
      return;
    }
    
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setChainId(null);
    
    // 清除 localStorage
    localStorage.removeItem('wallet_account');
    localStorage.removeItem('wallet_chainId');
    
    pushLog("已断开本地连接");
    toast.success('已断开钱包连接', { icon: '👋' });
  }

  

  // 随机字符串并签名
  async function signRandom() {
    const toastId = toast.loading('正在请求签名...');
    try {
      if (!signer) throw new Error("请先连接钱包");
      const random = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const sig = await signer.signMessage(random);
      pushLog(`随机字符串: ${random}`);
      pushLog(`签名: ${sig}`);
      toast.success('签名成功！', { id: toastId, icon: '✍️' });
    } catch (e) {
      const error = e as Error;
      pushLog(`签名失败: ${error.message || String(e)}`);
      toast.error(`签名失败: ${error.message}`, { id: toastId });
    }
  }

  // 切换链
  async function switchChain(target: ChainConfig) {
    const toastId = toast.loading(`正在切换到 ${target.name}...`);
    try {
      if (!window.ethereum) throw new Error("未检测到钱包");
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: target.chainId }],
      });
      pushLog(`已请求切换到 ${target.name} (${target.chainId})`);
      toast.success(`成功切换到 ${target.name}`, { id: toastId, icon: '🔗' });
    } catch (e: unknown) {
      const error = e as { code?: number; message?: string };
      
      // 错误码 4902 表示该链未添加到 MetaMask
      if (error.code === 4902) {
        try {
          toast.loading(`正在添加 ${target.name} 到钱包...`, { id: toastId });
          
          // 添加新网络
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
          
          pushLog(`已添加并切换到 ${target.name}`);
          toast.success(`成功添加 ${target.name}！`, { id: toastId, icon: '✨' });
        } catch (addError) {
          const err = addError as Error;
          pushLog(`添加网络失败: ${err.message || String(addError)}`);
          toast.error(`添加失败: ${err.message}`, { id: toastId });
        }
      } else {
        // 其他错误（用户拒绝等）
        const errMsg = error.message || String(e);
        pushLog(`切换链失败: ${errMsg}`);
        toast.error(`切换失败: ${errMsg}`, { id: toastId });
      }
    }
  }

  // 解析 ABI
  function tryParseAbi() {
    const toastId = toast.loading('正在解析 ABI...');
    try {
      const cleanText = abiText.replace(/,\s*([\]}])/g, '$1')
      const parsed = JSON.parse(cleanText);
      if (!Array.isArray(parsed)) throw new Error("ABI 不是数组");
      setAbi(parsed as AbiItem[]);
      setParseError(null);
      pushLog("ABI 解析成功");
      toast.success(`解析成功！识别到 ${(parsed as AbiItem[]).filter(a => a.type === 'function').length} 个函数`, { 
        id: toastId, 
        icon: '📄',
        duration: 3000 
      });
    } catch (e) {
      const error = e as Error;
      setParseError(error.message || String(e));
      setAbi([]);
      pushLog(`ABI 解析失败: ${error.message || String(e)}`);
      toast.error(`解析失败: ${error.message}`, { id: toastId });
    }
  }

  // 根据 abi 过滤出函数项
  const functions = useMemo(() => abi.filter((a) => a.type === "function"), [abi]);

  // 根据函数与参数构造 key
  function getFnKey(fn: AbiItem) {
    const name = fn.name || "";
    const types = (fn.inputs || []).map((i) => i.type).join(",");
    return `${name}(${types})`;
  }

  // 更新某个参数值
  function updateParam(fnKey: string, idx: number, value: string) {
    const key = `${fnKey}#${idx}`;
    setParamsState((s) => ({ ...s, [key]: value }));
  }

  // 从 paramsState 取值并尝试转换到合适类型
  function parseParamValue(type: string, raw: string, paramName?: string): string | boolean {
    // 这里只支持基本类型，数组/struct 未支持
    if (type.startsWith("uint") || type.startsWith("int")) {
      // 支持十进制数字输入
      if (raw.trim() === "") throw new Error("空值");
      
      // 检查是否是 amount/value 类型的参数，如果是则自动乘以 decimals
      const isAmountParam = paramName && (
        paramName.toLowerCase().includes('amount') ||
        paramName.toLowerCase().includes('value') ||
        paramName.toLowerCase() === 'wad' ||
        paramName.toLowerCase().includes('qty') ||
        paramName.toLowerCase().includes('quantity')
      );
      
      if (isAmountParam) {
        // 如果输入包含小数点，说明是人类可读格式，需要转换
        if (raw.includes('.') || (parseFloat(raw) < 1000000 && parseFloat(raw) > 0)) {
          const decimals = contractAddress.toLowerCase() === "0xdac17f958d2ee523a2206206994597c13d831ec7" ? 6 : 18;
          const numValue = parseFloat(raw);
          const bigIntValue = BigInt(Math.floor(numValue * Math.pow(10, decimals)));
          console.log(`💰 ${paramName} 智能转换: ${raw} → ${bigIntValue.toString()} (decimals: ${decimals})`);
          return bigIntValue.toString();
        }
      }
      
      // 使用 BigNumber 也可以，但 ethers 自动处理数字字符串
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
    if (type.startsWith("bytes")) return raw; // 用户需传 hex 或字符串
    // fallback
    return raw;
  }

  // 执行函数（call 或 send）
  async function callFunction(fn: AbiItem) {
    const isReadOnly = fn.stateMutability === "view" || fn.stateMutability === "pure";
    const toastId = toast.loading(isReadOnly ? `正在查询 ${fn.name}...` : `正在发送交易 ${fn.name}...`);
    
    try {
      if (!window.ethereum) throw new Error("请先安装 MetaMask");
      if (!account) throw new Error("请先连接钱包");
      if (!contractAddress) throw new Error("请输入合约地址");
      
      // 每次调用前重新获取最新的 provider 和 signer，确保使用当前网络
      console.log('🔄 重新获取 provider 以确保使用当前网络...');
      const currentProvider = new BrowserProvider(window.ethereum);
      const currentSigner = await currentProvider.getSigner();
      console.log('✅ Provider 已更新为当前网络');
      
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
        pushLog(`函数 ${fn.name} 调用结果: ${result}`);
        toast.success(`查询成功！结果: ${result.length > 50 ? result.slice(0, 50) + '...' : result}`, { 
          id: toastId, 
          icon: '📖',
          duration: 4000 
        });
      } else {
        // 非 view -> 发送交易
        const functionFragment = contract.getFunction(fn.name!);
        
        toast.loading('等待用户确认交易...', { id: toastId });
        const txResp = await functionFragment(...args);
        
        pushLog(`已发送交易 txHash: ${txResp.hash}`);
        toast.loading(`交易已发送，等待确认... (${txResp.hash.slice(0, 10)}...)`, { id: toastId });
        
        // 等待 1 个确认
        const receipt = await txResp.wait(1);
        pushLog(`交易确认: blockNumber=${receipt?.blockNumber}, status=${receipt?.status}`);
        
        toast.success(`交易成功！`, { 
          id: toastId, 
          icon: '🚀',
          duration: 5000 
        });
      }
    } catch (e) {
      const error = e as Error;
      pushLog(`调用失败: ${error.message || String(e)}`);
      
      // 根据错误类型显示不同的提示
      if (error.message.includes('user rejected') || error.message.includes('User denied')) {
        toast.error('用户取消了交易', { id: toastId, icon: '🚫' });
      } else if (error.message.includes('insufficient funds')) {
        toast.error('余额不足', { id: toastId, icon: '💸' });
      } else if (error.message.includes('network changed') || error.message.includes('NETWORK_ERROR')) {
        toast.error('网络已切换，请重新调用', { id: toastId, icon: '🔄' });
      } else if (error.message.includes('wrong network') || error.message.includes('chain mismatch')) {
        toast.error('合约不在当前网络，请切换网络', { id: toastId, icon: '⚠️' });
      } else {
        // 提取有用的错误信息
        const errorMsg = error.message.split('\n')[0]; // 只取第一行
        toast.error(`调用失败: ${errorMsg.length > 100 ? errorMsg.slice(0, 100) + '...' : errorMsg}`, { 
          id: toastId,
          duration: 5000 
        });
      }
    }
  }

  function stringifyResult(res: unknown, functionName?: string): string {
    console.log('stringifyResult', res, functionName);
    try {
      // 处理数组
      if (Array.isArray(res)) {
        return JSON.stringify(res.map((r) => stringifyResult(r, functionName)));
      }
      
      // 根据合约地址判断 decimals
      const getDecimals = () => {
        // USDT 使用 6 位小数
        if (contractAddress.toLowerCase() === "0xdac17f958d2ee523a2206206994597c13d831ec7") {
          return 6;
        }
        // 其他 ERC20 代币默认使用 18 位
        return 18;
      };
      
      // 处理 BigInt
      if (typeof res === "bigint") {
        const rawValue = res.toString();
        // 如果是余额相关函数，同时显示转换后的值
        if (functionName && (
          functionName.toLowerCase().includes('balance') || 
          functionName.toLowerCase().includes('supply')
        )) {
          const decimals = getDecimals();
          const converted = Number(res) / Math.pow(10, decimals);
          return `${converted.toLocaleString('en-US', { maximumFractionDigits: 6 })} (原始: ${rawValue})`;
        }
        return rawValue;
      }
      
      // 处理对象（包括 BigNumber）
      if (res && typeof res === "object") {
        if ("_isBigNumber" in res || "toString" in res) {
          const rawValue = (res as { toString: () => string }).toString();
          // 如果是余额相关函数，同时显示转换后的值
          if (functionName && (
            functionName.toLowerCase().includes('balance') || 
            functionName.toLowerCase().includes('supply')
          )) {
            const decimals = getDecimals();
            const converted = Number(rawValue) / Math.pow(10, decimals);
            return `${converted.toLocaleString('en-US', { maximumFractionDigits: 6 })} (原始: ${rawValue})`;
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

        {/* 钱包连接区域 */}
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
                  <span>{account ? "已连接" : "连接钱包"}</span>
                </button>
                {account && (
                  <button 
                    className="px-4 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-all duration-200 hover:scale-105 transform" 
                    onClick={disconnect}
                  >
                    断开
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
              <span>签名测试</span>
            </button>

            {account && (
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 px-6 py-3 rounded-xl border-2 border-indigo-200 shadow-md">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">已连接</span>
                </div>
                <div className="text-sm font-mono font-bold text-indigo-900">
                  {account.slice(0, 6)}...{account.slice(-4)}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  链 ID: <span className="font-semibold text-indigo-600">{chainId ?? "-"}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ABI 配置区域 */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 md:p-8 mb-8 border border-gray-100">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* ABI 输入 */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <label className="flex items-center gap-2 font-bold text-gray-800 text-xl">
                  <span className="text-2xl">📄</span>
                  <span>ABI JSON</span>
                </label>
                <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-semibold">
                  必填
                </span>
              </div>
              <textarea
                rows={14}
                value={abiText}
                onChange={(e) => setAbiText(e.target.value)}
                className="w-full border-2 border-gray-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 p-4 rounded-xl font-mono text-sm transition-all duration-200 resize-none bg-gray-50 hover:bg-white shadow-inner"
                placeholder='粘贴合约 ABI JSON 数组...'
              />
              <div className="flex flex-wrap gap-3 mt-4">
                <button 
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transform transition-all duration-300 flex items-center gap-2" 
                  onClick={tryParseAbi}
                >
                  <span>🔍</span>
                  <span>解析 ABI</span>
                </button>
                <button
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transform transition-all duration-300 flex items-center gap-2"
                  onClick={() => {
                    const sampleAbi = getSampleAbi();
                    setAbiText(JSON.stringify(sampleAbi, null, 2));
                    setContractAddress("0x779877A7B0D9E8603169DdbD7836e478b4624789");
                    switchChain(CHAIN_MAP.sepolia);
                    
                    // 自动填充 balanceOf 参数
                    setTimeout(() => {
                      setParamsState({
                        'balanceOf(address)#0': '0x4281eCF07378Ee595C564a59048801330f3084eE'
                      });
                    }, 100);
                    
                    toast.success('已插入 LINK 合约示例并填充测试地址', { 
                      icon: '🔗',
                      duration: 3000 
                    });
                  }}
                >
                  <span>🔗</span>
                  <span>LINK 示例（Sepolia 测试网）</span>
                </button>
              
                
                <button
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transform transition-all duration-300 flex items-center gap-2"
                  onClick={() => {
                    const usdtAbi = getUsdtMainnetAbi();
                    setAbiText(JSON.stringify(usdtAbi, null, 2));
                    setContractAddress("0xdAC17F958D2ee523a2206206994597C13D831ec7");
                    switchChain(CHAIN_MAP.ethereum);
                    // 自动填充 balanceOf 参数 - Vitalik 的地址
                    setTimeout(() => {
                      setParamsState({
                        'balanceOf(address)#0': '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
                      });
                    }, 100);
                    toast.success('已插入 USDT 主网合约示例（Vitalik 地址）', { 
                      icon: '💵',
                      duration: 3000 
                    });
                  }}
                >
                  <span>💵</span>
                  <span>USDT 示例 (主网)</span>
                </button>
              </div>
              {parseError && (
                <div className="mt-4 p-4 bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-300 rounded-xl text-red-800 text-sm shadow-md animate-shake">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">❌</span>
                    <div>
                      <div className="font-bold mb-1">解析错误</div>
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
                      <div className="font-bold text-green-800">解析成功！</div>
                      <div className="text-green-700 text-sm">已识别 <span className="font-bold text-lg">{functions.length}</span> 个函数</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 右侧配置 */}
            <div className="space-y-6">
              {/* 合约地址 */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="flex items-center gap-2 font-bold text-gray-800 text-xl">
                    <span className="text-2xl">📍</span>
                    <span>合约地址</span>
                  </label>
                  <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-semibold">
                    必填
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
                    <div className="font-bold">💡 提示</div>
                    <div>此为 LINK 测试币合约（<span className="font-bold">Sepolia 测试网</span>）</div>
                  </div>
                )}
                {contractAddress === "0xdAC17F958D2ee523a2206206994597C13D831ec7" && (
                  <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
                    <div className="font-bold flex items-center gap-2">
                      <span>💡</span>
                      <span>提示</span>
                    </div>
                    <div className="mt-1 space-y-1">
                      <div>• 此为 USDT 稳定币合约（<span className="font-bold">Ethereum 主网</span>）</div>
                      <div>• 查询地址为 <span className="font-bold">Vitalik Buterin</span> 的钱包</div>
                      <div>• USDT decimals 为 <span className="font-bold">6</span>（系统已自动识别）</div>
                    </div>
                  </div>
                )}
              </div>

              {/* 切换链 */}
              <div>
                <label className="flex items-center gap-2 font-bold text-gray-800 text-xl mb-4">
                  <span className="text-2xl">🔗</span>
                  <span>切换网络</span>
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

        {/* 函数调用区域 */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 md:p-8 mb-8 border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-4xl">⚡</span>
            <h2 className="text-3xl font-black text-gray-800">智能合约函数</h2>
            {functions.length > 0 && (
              <span className="ml-auto bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
                {functions.length} 个函数
              </span>
            )}
          </div>
          
          {functions.length === 0 && (
            <div className="text-center py-20 bg-gradient-to-br from-gray-50 to-slate-100 rounded-2xl border-2 border-dashed border-gray-300">
              <div className="text-7xl mb-6 animate-bounce">📭</div>
              <div className="text-xl font-bold text-gray-400 mb-2">暂无函数</div>
              <div className="text-gray-500">请先解析 ABI 以生成函数调用界面</div>
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
                          {isReadOnly ? "🔍 只读" : "✍️ 写入"} · {fn.stateMutability ?? "nonpayable"}
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
                      {isReadOnly ? "📖 调用查询" : "🚀 发送交易"}
                    </button>
                  </div>

                  {(fn.inputs || []).length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white/60 rounded-xl border border-gray-200">
                      {(fn.inputs || []).map((inp, idx) => {
                        const key = `${fnKey}#${idx}`;
                        return (
                          <div key={key}>
                            <label className="block text-sm font-bold text-gray-800 mb-2">
                              {inp.name || `参数 ${idx + 1}`}
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

        {/* 日志输出区域 */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 md:p-8 border border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="text-4xl">📊</span>
              <h2 className="text-3xl font-black text-gray-800">执行日志</h2>
              {logs.length > 0 && (
                <span className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                  {logs.length} 条
                </span>
              )}
            </div>
            <button 
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold text-sm transition-all duration-300 hover:scale-105 transform shadow-lg hover:shadow-xl flex items-center gap-2"
              onClick={() => setLogs([])}
              disabled={logs.length === 0}
            >
              <span>🗑️</span>
              <span>清空日志</span>
            </button>
          </div>
          <div className="relative">
            <div className="h-96 overflow-auto border-2 border-gray-300 rounded-2xl p-5 bg-gradient-to-br from-slate-900 via-gray-900 to-black text-green-400 text-sm font-mono shadow-2xl">
              {logs.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-gray-600">
                  <div className="text-5xl mb-4">💻</div>
                  <div className="text-lg font-bold">暂无日志记录</div>
                  <div className="text-xs mt-2">执行函数后日志将显示在这里</div>
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
            {/* 终端效果装饰 */}
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

// ---------- 辅助函数 ----------

function placeholderForType(t: string) {
  if (t.startsWith("uint") || t.startsWith("int")) return "例如: 123 或 1000000000000000000";
  if (t === "address") return "例如: 0xabc...";
  if (t === "bool") return "true / false";
  if (t === "string") return "任意文本";
  if (t.startsWith("bytes")) return "十六进制或文本";
  return "输入值";
}

function getUsdtMainnetAbi(): AbiItem[] {
  // USDT (Tether) ERC20 合约 ABI 示例
  // 合约地址 (Ethereum 主网): 0xdAC17F958D2ee523a2206206994597C13D831ec7
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
  // LINK 测试币 ERC20 合约 ABI 示例
  // 合约地址 (Sepolia 测试网): 0x779877A7B0D9E8603169DdbD7836e478b4624789
  // 这是 Chainlink 官方的 LINK 测试代币，可以免费从水龙头获取
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
