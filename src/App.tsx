import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CloudUpload as UploadCloud, File, Trash2, Mail, CircleAlert as AlertCircle, CircleCheck as CheckCircle2, Archive, RefreshCcw, Paperclip, X, Eye } from 'lucide-react';
import { cn } from './lib/utils';
import { parseEmailFile } from './lib/emailParser';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface ProcessedFile {
  originalFile: globalThis.File;
  parsedName: string;
  textContent: string | null;
  attachments: string[];
  status: 'pending' | 'processing' | 'success' | 'error';
  errorMessage?: string;
}

export default function App() {
  const [files, setFiles] = useState<globalThis.File[]>([]);
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [previewFile, setPreviewFile] = useState<ProcessedFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionId = useRef(`CT-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addFiles = (newFiles: globalThis.File[]) => {
    setFiles(prev => {
      const combined = [...prev, ...newFiles];
      if (combined.length > 100) {
        alert("Maximum 100 files allowed at once.");
        return combined.slice(0, 100);
      }
      return combined;
    });
  };

  const removeFile = (indexToRemove: number) => {
    setFiles(prev => prev.filter((_, i) => i !== indexToRemove));
  };

  const startConversion = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setProgressIndex(0);

    const initial: ProcessedFile[] = files.map(f => ({
      originalFile: f,
      parsedName: f.name.replace(/\.(eml|msg)$/i, '.txt'),
      textContent: null,
      attachments: [],
      status: 'pending',
    }));
    setProcessedFiles(initial);

    const results: ProcessedFile[] = [...initial];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgressIndex(i);
      results[i] = { ...results[i], status: 'processing' };
      setProcessedFiles([...results]);

      try {
        const parsed = await parseEmailFile(file);
        results[i] = {
          originalFile: file,
          parsedName: file.name.replace(/\.(eml|msg)$/i, '.txt'),
          textContent: parsed.text,
          attachments: parsed.attachments,
          status: 'success',
        };
      } catch (err: any) {
        results[i] = {
          originalFile: file,
          parsedName: file.name,
          textContent: null,
          attachments: [],
          status: 'error',
          errorMessage: err.message || 'Conversion failed',
        };
      }
      setProcessedFiles([...results]);
    }

    setProgressIndex(files.length);
    setIsProcessing(false);
  };

  const reset = () => {
    setFiles([]);
    setProcessedFiles([]);
    setIsProcessing(false);
    setProgressIndex(0);
    setPreviewFile(null);
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    let count = 0;
    processedFiles.forEach(doc => {
      if (doc.status === 'success' && doc.textContent) {
        zip.file(doc.parsedName, doc.textContent);
        count++;
      }
    });
    if (count === 0) return alert("No successful conversions to download.");
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, 'converted_emails.zip');
  };

  const downloadMerged = () => {
    const valid = processedFiles.filter(d => d.status === 'success' && d.textContent);
    if (valid.length === 0) return alert("No successful conversions to download.");
    const separator = "\n\n" + "=".repeat(80) + "\n\n";
    const mergedText = valid
      .map(d => `--- Original File: ${d.originalFile.name} ---\n\n${d.textContent}`)
      .join(separator);
    const blob = new Blob([mergedText], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, 'merged_emails.txt');
  };

  const isCompleted = processedFiles.length > 0 && !isProcessing;
  const successCount = processedFiles.filter(p => p.status === 'success').length;
  const progressPercent = files.length > 0 ? Math.round((progressIndex / files.length) * 100) : 0;

  return (
    <div className="w-full h-full flex items-center justify-center relative p-4 sm:p-8">
      {/* Mesh Gradient Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-teal-500/20 rounded-full blur-[150px]"></div>
      <div className="absolute top-[20%] right-[10%] w-[400px] h-[400px] bg-cyan-600/15 rounded-full blur-[100px]"></div>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/60 backdrop-blur-sm"
            onClick={() => setPreviewFile(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.18 }}
              className="relative w-full max-w-3xl max-h-[80vh] bg-[#0f1f35] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <File className="w-4 h-4 text-teal-400 shrink-0" />
                  <p className="text-sm font-medium truncate">{previewFile.parsedName}</p>
                </div>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 ml-4"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {previewFile.attachments.length > 0 && (
                <div className="px-6 py-3 border-b border-white/5 flex items-center gap-2 flex-wrap shrink-0">
                  <Paperclip className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  {previewFile.attachments.map((name, i) => (
                    <span key={i} className="text-[11px] bg-white/5 border border-white/10 text-slate-300 px-2 py-0.5 rounded-md">
                      {name}
                    </span>
                  ))}
                </div>
              )}
              <pre className="flex-1 overflow-y-auto p-6 text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap break-words custom-scrollbar">
                {previewFile.textContent}
              </pre>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Application Interface */}
      <div className="relative w-full max-w-5xl h-full max-h-[800px] bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[32px] shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <nav className="h-20 px-6 lg:px-10 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Mail2Text Pro
            </h1>
          </div>
          <div className="flex items-center gap-4 sm:gap-6 text-sm font-medium text-slate-400">
            <span className="text-white hidden sm:block">Converter</span>
            <button
              onClick={reset}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl border border-white/10 transition-all shadow-sm active:scale-95"
              title="Start New Session"
            >
              <RefreshCcw className="w-4 h-4" />
              <span className="hidden sm:block">Start Over</span>
            </button>
          </div>
        </nav>

        {/* Body Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">

          {/* Left Panel */}
          <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-white/5 p-6 lg:p-10 flex flex-col overflow-y-auto">
            <div className="mb-8">
              <h2 className="text-3xl font-light mb-2">Batch Convert</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Transform complex emails into distraction-free plain text. Links and safelinks are automatically simplified.
              </p>
            </div>

            {!isCompleted ? (
              <div
                className={cn(
                  "flex-1 border-2 border-dashed rounded-2xl transition-colors flex flex-col items-center justify-center p-8 text-center cursor-pointer mb-6 shrink-0 min-h-[200px]",
                  isDragging
                    ? "border-teal-500/50 bg-teal-500/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".eml,.msg"
                  onChange={handleFileInput}
                  className="hidden"
                  disabled={isProcessing}
                />
                <div className="w-16 h-16 rounded-full bg-teal-500/10 flex items-center justify-center mb-4">
                  <UploadCloud className="w-8 h-8 text-teal-400" />
                </div>
                <p className="text-lg font-medium">Click to upload</p>
                <p className="text-xs text-slate-500 mt-2">
                  Drag & Drop up to 100 .eml or .msg files
                </p>
              </div>
            ) : (
              <div className="flex-1 bg-white/5 rounded-2xl border border-white/10 flex flex-col items-center justify-center p-8 text-center mb-6 min-h-[200px]">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-xl font-medium mb-2">Conversion Complete</h3>
                <p className="text-slate-400 text-sm mb-6 max-w-xs">
                  Successfully processed {successCount} of {processedFiles.length} files.
                </p>
                <button
                  onClick={reset}
                  className="inline-flex items-center gap-2 text-sm text-teal-400 hover:text-teal-300 font-medium transition-colors"
                >
                  <RefreshCcw className="w-4 h-4" />
                  Process more files
                </button>
              </div>
            )}

            {/* Progress Bar (visible while processing) */}
            {isProcessing && (
              <div className="mb-6 shrink-0">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs text-slate-400 truncate pr-4">
                    Processing: <span className="text-white font-medium">{files[progressIndex]?.name}</span>
                  </p>
                  <span className="text-xs text-teal-400 font-mono shrink-0">
                    {Math.min(progressIndex + 1, files.length)} / {files.length}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1 text-right">{progressPercent}%</p>
              </div>
            )}

            {/* Quick Settings */}
            <div className="space-y-4 shrink-0 mt-auto">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                <div>
                  <p className="text-sm font-medium">Sanitize URLs</p>
                  <p className="text-[10px] text-slate-500">Removes long tracking strings & safelinks</p>
                </div>
                <div className="w-10 h-5 bg-teal-500 rounded-full relative flex items-center px-1 shadow-inner">
                  <div className="w-3 h-3 bg-white rounded-full translate-x-5 shadow-sm"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: Queue */}
          <div className="lg:col-span-7 bg-black/10 p-6 lg:p-10 flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h3 className="text-sm font-bold uppercase tracking-widest text-teal-400">
                Processing Queue
              </h3>
              <span className="text-xs bg-teal-500/20 text-teal-300 px-3 py-1 rounded-full border border-teal-500/30">
                {files.length} / 100 Files
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pr-2 custom-scrollbar">
              {files.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-500">
                  <File className="w-8 h-8 mb-3 opacity-20" />
                  <p className="text-sm">Queue is empty</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <AnimatePresence mode="popLayout">
                    {!isProcessing && !isCompleted ? files.map((file, i) => (
                      <motion.div
                        key={`${file.name}-${file.lastModified}-${i}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        layout
                        className="bg-white/5 p-4 rounded-xl flex items-center gap-4 border border-white/5 group hover:bg-white/10 transition-colors"
                      >
                        <div className="text-xs font-mono text-slate-500 min-w-[1.5rem]">
                          {(i + 1).toString().padStart(2, '0')}
                        </div>
                        <div className="flex-1 overflow-hidden pr-2">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-[10px] text-slate-500">Queued</p>
                        </div>
                        <div className="text-xs text-slate-400 whitespace-nowrap hidden sm:block">
                          {(file.size / 1024).toFixed(1)} KB
                        </div>
                        <button
                          onClick={() => removeFile(i)}
                          className="p-1.5 shrink-0 text-slate-500 hover:text-red-400 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </motion.div>
                    )) : processedFiles.map((doc, i) => (
                      <motion.div
                        key={`res-${i}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        layout
                        className={cn(
                          "p-4 rounded-xl flex items-start gap-4 border",
                          doc.status === 'success' ? "bg-teal-500/10 border-teal-500/20" :
                          doc.status === 'error' ? "bg-red-500/10 border-red-500/20" :
                          doc.status === 'processing' ? "bg-blue-500/10 border-blue-500/20" :
                          "bg-white/5 border-white/5"
                        )}
                      >
                        <div className="text-xs font-mono text-slate-500 min-w-[1.5rem] mt-0.5">
                          {(i + 1).toString().padStart(2, '0')}
                        </div>
                        <div className="flex-1 overflow-hidden pr-2">
                          <p className="text-sm font-medium truncate">
                            {doc.status === 'success' ? doc.parsedName : doc.originalFile.name}
                          </p>
                          {doc.status === 'error' ? (
                            <p className="text-[10px] text-red-400 truncate" title={doc.errorMessage}>
                              {doc.errorMessage}
                            </p>
                          ) : doc.status === 'processing' ? (
                            <p className="text-[10px] text-blue-400">Converting...</p>
                          ) : doc.status === 'success' ? (
                            <div>
                              <p className="text-[10px] text-teal-400">Converted</p>
                              {doc.attachments.length > 0 && (
                                <div className="flex items-center gap-1 mt-1 flex-wrap">
                                  <Paperclip className="w-3 h-3 text-slate-500 shrink-0" />
                                  {doc.attachments.map((name, ai) => (
                                    <span key={ai} className="text-[10px] bg-white/5 border border-white/10 text-slate-400 px-1.5 py-0.5 rounded">
                                      {name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-500">Pending</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 mt-0.5">
                          {doc.status === 'success' && (
                            <button
                              onClick={() => setPreviewFile(doc)}
                              className="p-1.5 text-slate-500 hover:text-teal-400 rounded-lg transition-colors"
                              title="Preview converted text"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          {doc.status === 'success' && <CheckCircle2 className="w-4 h-4 text-teal-400" />}
                          {doc.status === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
                          {doc.status === 'processing' && (
                            <RefreshCcw className="w-4 h-4 text-blue-400 animate-spin" />
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Final Actions */}
            <div className="mt-6 flex flex-col sm:flex-row gap-4 shrink-0">
              {!isCompleted ? (
                <button
                  onClick={startConversion}
                  disabled={files.length === 0 || isProcessing}
                  className="flex-1 h-12 sm:h-14 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-xl font-bold shadow-lg shadow-teal-500/20 active:scale-[0.98] disabled:opacity-50 disabled:grayscale transition-all text-white flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCcw className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    `Process Batch (${files.length})`
                  )}
                </button>
              ) : (
                <>
                  <button
                    onClick={downloadZip}
                    className="flex-1 h-12 sm:h-14 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-xl font-bold shadow-lg shadow-teal-500/20 active:scale-[0.98] transition-all text-white flex items-center justify-center gap-2"
                  >
                    <Archive className="w-5 h-5" />
                    Download ZIP
                  </button>
                  <button
                    onClick={downloadMerged}
                    className="px-6 h-12 sm:h-14 border border-white/10 bg-white/5 rounded-xl font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                  >
                    <File className="w-5 h-5" />
                    <span className="hidden sm:inline">Download</span> Merged
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-12 bg-white/5 px-6 lg:px-10 flex items-center justify-between text-[10px] font-mono tracking-widest text-slate-400 uppercase shrink-0 border-t border-white/5 overflow-hidden">
          <span className="truncate pr-4">Session: {sessionId.current}</span>
          <div className="hidden sm:flex gap-8 shrink-0">
            <span>Capacity: {files.length} / 100</span>
            <span>Engine: v2.5.0 (Regex Obj)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
