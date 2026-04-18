"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MoreVertical, Phone, Video, Search, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api, type DemoChat, type DemoMessage, type VerificationResult } from "@/lib/api";
import { cn, formatTime } from "@/lib/utils";
import { useKeystrokeCapture, type BehaviorScore } from "@/lib/useKeystrokeCapture";
import { CrIcon } from "@/components/nutrition/CrIcon";
import { NutritionSheet } from "@/components/nutrition/NutritionSheet";

export default function FakeAppPage() {
  const [chats, setChats] = useState<DemoChat[]>([]);
  const [messages, setMessages] = useState<DemoMessage[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [sheetResult, setSheetResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.whatsapp().then((d) => {
      setChats(d.chats);
      setMessages(d.messages);
      setActiveChatId(d.chats[0]?.id ?? null);
      setLoading(false);
    });
  }, []);

  const activeChat = chats.find((c) => c.id === activeChatId);
  const chatMessages = messages
    .filter((m) => m.chat_id === activeChatId)
    .sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="border-b border-ink-600/40 px-4 md:px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-ink-300 hover:text-ink-50 transition-colors">
          <ArrowLeft size={16} />
          <span className="text-sm">TrustLayer</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="cr-icon text-amber-glow border-amber-glow/40 text-[0.5rem] w-5 h-5">CR</span>
          <span className="text-sm text-ink-200 font-display">FakeApp</span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className={cn(
          "w-full md:w-80 lg:w-96 border-r border-ink-600/40 flex flex-col",
          activeChatId && "hidden md:flex",
        )}>
          <div className="px-4 py-4 border-b border-ink-600/40">
            <div className="font-display text-xl mb-3">Wiadomości</div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                placeholder="Szukaj rozmów..."
                className="w-full bg-ink-700/40 rounded-md pl-9 pr-3 py-2 text-sm text-ink-100 placeholder:text-ink-400 outline-none focus:bg-ink-700/70"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-ink-400 text-sm">Ładowanie...</div>
            ) : (
              chats.map((c) => {
                const lastMsg = messages
                  .filter((m) => m.chat_id === c.id)
                  .sort((a, b) => b.timestamp - a.timestamp)[0];
                return (
                  <ChatRow
                    key={c.id}
                    chat={c}
                    lastMessage={lastMsg}
                    active={c.id === activeChatId}
                    onClick={() => setActiveChatId(c.id)}
                  />
                );
              })
            )}
          </div>
        </aside>

        {/* Main chat */}
        <main className={cn(
          "flex-1 flex flex-col",
          !activeChatId && "hidden md:flex",
        )}>
          {activeChat ? (
            <ChatView
              chat={activeChat}
              messages={chatMessages}
              onBack={() => setActiveChatId(null)}
              onShowSheet={setSheetResult}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-ink-400">
              Wybierz rozmowę
            </div>
          )}
        </main>
      </div>

      <NutritionSheet
        result={sheetResult}
        open={sheetResult !== null}
        onClose={() => setSheetResult(null)}
      />
    </div>
  );
}

// ---------- ChatRow ----------

function ChatRow({
  chat, lastMessage, active, onClick,
}: { chat: DemoChat; lastMessage?: DemoMessage; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full px-4 py-3 flex items-start gap-3 text-left border-b border-ink-700/40 hover:bg-ink-700/30 transition-colors",
        active && "bg-ink-700/40",
      )}
    >
      <div className="text-3xl flex-shrink-0">{chat.avatar}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-medium text-ink-50 truncate">{chat.name}</span>
            {chat.is_trusted_contact && (
              <span title="Zaufany kontakt z zarejestrowanym urządzeniem">
                <CrIcon status="verified" size="sm" />
              </span>
            )}
          </div>
          {lastMessage && (
            <span className="text-[10px] text-ink-400 flex-shrink-0 ml-2 font-mono">
              {formatTime(lastMessage.timestamp)}
            </span>
          )}
        </div>
        <div className="text-sm text-ink-300 truncate">
          {lastMessage?.plain_text || "—"}
        </div>
      </div>
    </button>
  );
}

// ---------- ChatView ----------

function ChatView({
  chat, messages, onBack, onShowSheet,
}: {
  chat: DemoChat;
  messages: DemoMessage[];
  onBack: () => void;
  onShowSheet: (r: VerificationResult) => void;
}) {
  const { onKeyDown, onKeyUp, score, reset, getEvents } = useKeystrokeCapture();
  const [text, setText] = useState("");

  const handleSend = async () => {
    if (!text.trim()) return;
    const keystrokes = getEvents();
    reset();
    setText("");
    try {
      const result = await api.verifyText(text, keystrokes);
      onShowSheet(result);
    } catch {
      // demo — ignoruj błąd sieci
    }
  };

  return (
    <>
      {/* Chat header */}
      <div className="border-b border-ink-600/40 px-4 md:px-6 py-3 flex items-center gap-3">
        <button onClick={onBack} className="md:hidden text-ink-300">
          <ArrowLeft size={18} />
        </button>
        <div className="text-2xl">{chat.avatar}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-display text-base text-ink-50">{chat.name}</span>
            {chat.is_trusted_contact && (
              <CrIcon status="verified" size="sm" />
            )}
          </div>
          <div className="text-[11px] text-ink-400 font-mono">
            {chat.is_trusted_contact
              ? "Zarejestrowane urządzenie · TrustLayer aktywny"
              : "Brak zarejestrowanego urządzenia"}
          </div>
        </div>
        <div className="flex items-center gap-1 text-ink-400">
          <button className="p-2 hover:text-ink-200"><Video size={18} /></button>
          <button className="p-2 hover:text-ink-200"><Phone size={18} /></button>
          <button className="p-2 hover:text-ink-200"><MoreVertical size={18} /></button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-3 bg-gradient-to-b from-ink-900 to-ink-800/50">
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              chat={chat}
              onShowSheet={onShowSheet}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Composer */}
      <div className="border-t border-ink-600/40 px-4 md:px-6 py-3 space-y-2">
        <BehaviorBar score={score} />
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-3 bg-ink-700/40 rounded-full px-4 py-2.5 border border-ink-600/40 focus-within:border-amber-glow/40 transition-colors">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                onKeyDown();
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              onKeyUp={onKeyUp}
              placeholder="Napisz wiadomość — TrustLayer mierzy rytm pisania..."
              className="flex-1 bg-transparent outline-none text-sm text-ink-100 placeholder:text-ink-400"
            />
            <span className="cr-icon text-amber-glow/70 border-amber-glow/40 text-[0.5rem] w-5 h-5 flex-shrink-0">CR</span>
          </div>
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-amber-glow/20 border border-amber-glow/40 text-amber-glow disabled:opacity-30 disabled:cursor-not-allowed hover:bg-amber-glow/30 transition-colors flex-shrink-0"
          >
            <Send size={15} />
          </button>
        </div>
        <div className="text-[10px] text-ink-400 text-center font-mono">
          Każda wysłana wiadomość jest podpisywana lokalnie kluczem z Twojego urządzenia
        </div>
      </div>
    </>
  );
}

// ---------- BehaviorBar ----------

function BehaviorBar({ score }: { score: BehaviorScore }) {
  const { keystrokeCount, confidence, looksHuman } = score;
  const pct = Math.round(confidence * 100);

  if (keystrokeCount < 3) {
    return (
      <div className="flex items-center gap-2 px-1">
        <span className="text-[10px] font-mono text-ink-500 w-28 flex-shrink-0">Behawior: czekam…</span>
        <div className="flex-1 h-1 rounded-full bg-ink-700/60" />
      </div>
    );
  }

  const color = looksHuman
    ? "bg-verified"
    : confidence > 0.35
    ? "bg-amber-glow"
    : "bg-clash";

  const label = looksHuman
    ? `CZŁOWIEK ${pct}%`
    : confidence > 0.35
    ? `NIEPEWNE ${pct}%`
    : `BOT ${pct}%`;

  const textColor = looksHuman
    ? "text-verified"
    : confidence > 0.35
    ? "text-amber-glow"
    : "text-clash";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 px-1"
    >
      <span className={cn("text-[10px] font-mono w-28 flex-shrink-0 font-medium", textColor)}>
        {label}
      </span>
      <div className="flex-1 h-1 rounded-full bg-ink-700/60 overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", color)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", damping: 20, stiffness: 200 }}
        />
      </div>
      <span className="text-[10px] font-mono text-ink-500 w-12 text-right">
        {keystrokeCount}k
      </span>
    </motion.div>
  );
}

// ---------- MessageBubble ----------

function MessageBubble({
  message, chat, onShowSheet,
}: { message: DemoMessage; chat: DemoChat; onShowSheet: (r: VerificationResult) => void }) {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);

  // Auto-verify w tle
  useEffect(() => {
    setVerifying(true);
    api.verifyText(message.text)
      .then((r) => setResult(r))
      .catch(() => setResult(null))
      .finally(() => setVerifying(false));
  }, [message.text]);

  const isOwn = message.sender === "anna";

  // Wykryj czy "trusted contact" + bez podpisu = ALERT
  const isImpersonationAlert =
    chat.is_trusted_contact &&
    !isOwn &&
    result?.status === "unverified";

  // Decyzja jakim statusem oznaczyć — dla scam od trusted contact, treat as integrity_clash visually
  const visualStatus = isImpersonationAlert ? "integrity_clash" : result?.status;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn("flex gap-2", isOwn ? "justify-end" : "justify-start")}
    >
      {!isOwn && (
        <div className="text-2xl flex-shrink-0 self-end mb-1">{chat.avatar}</div>
      )}

      <div className={cn("flex flex-col", isOwn ? "items-end" : "items-start", "max-w-[80%] md:max-w-[60%]")}>
        {/* Impersonation banner */}
        {isImpersonationAlert && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-2 px-3 py-2 rounded-md bg-clash/15 border border-clash/40 text-xs text-clash flex items-center gap-2 max-w-sm"
          >
            <span className="font-display text-sm">⚠ Ostrzeżenie TrustLayer</span>
          </motion.div>
        )}

        <button
          onClick={() => result && onShowSheet(result)}
          className={cn(
            "group relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed text-left transition-all",
            isOwn
              ? "bg-amber-glow/15 text-ink-50 rounded-br-sm border border-amber-glow/30"
              : isImpersonationAlert
                ? "bg-clash/8 text-ink-100 rounded-bl-sm border border-clash/40"
                : "bg-ink-700/60 text-ink-100 rounded-bl-sm border border-ink-600/40",
          )}
        >
          <div>{message.plain_text}</div>

          <div className="mt-1.5 flex items-center justify-between gap-3">
            <span className="text-[10px] text-ink-400 font-mono">
              {formatTime(message.timestamp)}
            </span>
            {!verifying && result && (
              <CrIcon status={visualStatus!} size="sm" />
            )}
            {verifying && (
              <div className="w-3 h-3 border border-ink-400 border-t-transparent rounded-full animate-spin" />
            )}
          </div>
        </button>

        {/* Inline summary for non-verified */}
        {result && (result.status === "integrity_clash" || isImpersonationAlert) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ delay: 0.2 }}
            className="mt-1.5 max-w-sm"
          >
            <button
              onClick={() => onShowSheet(result)}
              className="text-[11px] text-clash hover:text-clash/80 underline underline-offset-2 leading-relaxed text-left"
            >
              {isImpersonationAlert
                ? `Ta wiadomość NIE pochodzi z zarejestrowanego urządzenia ${chat.name}. Możliwa próba oszustwa — kliknij po szczegóły.`
                : result.summary}
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
