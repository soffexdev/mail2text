import PostalMime from 'postal-mime';
import MsgReader from '@kenjiuno/msgreader';

export interface ParseResult {
  text: string;
  attachments: string[];
}

export const cleanText = (text: string): string => {
  if (!text) return '';

  let cleaned = text;

  // Strip URLs inside angle brackets e.g. <https://nam04.safelinks...>
  cleaned = cleaned.replace(/<https?:\/\/[^>]+>/gi, '[link removed]');

  // Strip standard URLs e.g. https://...
  cleaned = cleaned.replace(/https?:\/\/[^\s<>)"']+/gi, '[link removed]');

  // Remove zero-width characters that might be embedded in emails
  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // Clean up excessive newlines caused by link stripping (max 2 consecutive newlines)
  cleaned = cleaned.replace(/\n[ \t]*\n[ \t]*\n+/g, '\n\n');

  return cleaned.trim();
};

export const parseEmailFile = async (file: File): Promise<ParseResult> => {
  const extension = file.name.split('.').pop()?.toLowerCase();

  try {
    if (extension === 'eml') {
      const parser = new PostalMime();
      const email = await parser.parse(file as any);

      let bodyText = email.text || '';

      if (!bodyText && email.html) {
         bodyText = email.html
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<[^>]+>/g, '\n')
          .replace(/\n[\s]*\n/g, '\n\n');
      }

      const subject = email.subject || 'No Subject';
      const from = email.from?.address ? (email.from.name ? `${email.from.name} <${email.from.address}>` : email.from.address) : 'Unknown Sender';
      const date = email.date || 'Unknown Date';

      const formatRecipients = (recips: any[]) => {
        if (!recips || !recips.length) return '';
        return recips.map(r => r.name ? `${r.name} <${r.address}>` : r.address).join(', ');
      };

      const toStr = formatRecipients(email.to as any[]);
      const ccStr = formatRecipients(email.cc as any[]);
      const toLine = toStr ? `To: ${toStr}\n` : '';
      const ccLine = ccStr ? `Cc: ${ccStr}\n` : '';

      const header = `Subject: ${subject}\nFrom: ${from}\n${toLine}${ccLine}Date: ${date}\n\n`;

      const attachments = (email.attachments || [])
        .filter((a: any) => a.filename)
        .map((a: any) => a.filename as string);

      return { text: header + cleanText(bodyText), attachments };

    } else if (extension === 'msg') {
      const buffer = await file.arrayBuffer();
      const msgReader = new MsgReader(buffer);
      const msgData = msgReader.getFileData();

      const subject = msgData.subject || 'No Subject';
      const senderObj = [];
      if (msgData.senderName) senderObj.push(msgData.senderName);
      if (msgData.senderEmail) senderObj.push(`<${msgData.senderEmail}>`);
      const from = senderObj.length > 0 ? senderObj.join(' ') : 'Unknown Sender';
      const date = msgData.creationTime || 'Unknown Date';

      let toStr = '';
      let ccStr = '';

      if (msgData.recipients && msgData.recipients.length > 0) {
        const toRecips = msgData.recipients.filter(r => r.recipType === 'to');
        const ccRecips = msgData.recipients.filter(r => r.recipType === 'cc');

        const formatMsgRecips = (recips: any[]) => {
          return recips.map(r => {
            const email = r.smtpAddress || r.email || '';
            const name = r.name || '';
            if (name && email) return `${name} <${email}>`;
            if (name) return name;
            return email;
          }).filter(Boolean).join(', ');
        };

        toStr = formatMsgRecips(toRecips);
        ccStr = formatMsgRecips(ccRecips);
      }

      const toLine = toStr ? `To: ${toStr}\n` : '';
      const ccLine = ccStr ? `Cc: ${ccStr}\n` : '';

      const header = `Subject: ${subject}\nFrom: ${from}\n${toLine}${ccLine}Date: ${date}\n\n`;

      const attachments = (msgData.attachments || [])
        .map((a: any) => a.fileName || a.name || '')
        .filter(Boolean);

      return { text: header + cleanText(msgData.body || ''), attachments };

    } else {
      const text = await file.text();
      return { text: cleanText(text), attachments: [] };
    }
  } catch (err) {
    console.error(`Failed to parse ${file.name}:`, err);
    throw new Error(`Failed to process ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
};
