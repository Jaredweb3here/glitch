import tls from 'node:tls';

function parseRedisConfig() {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return {
      type: 'rest',
      url: process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/, ''),
      token: process.env.UPSTASH_REDIS_REST_TOKEN
    };
  }

  if (!process.env.REDIS_URL) return null;
  const redisUrl = new URL(process.env.REDIS_URL);
  return {
    type: 'redis',
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
    username: decodeURIComponent(redisUrl.username || 'default'),
    password: decodeURIComponent(redisUrl.password)
  };
}

function encodeRedisCommand(parts) {
  return `*${parts.length}\r\n${parts.map(part => {
    const value = String(part);
    return `$${Buffer.byteLength(value)}\r\n${value}\r\n`;
  }).join('')}`;
}

function parseRespValues(buffer) {
  let offset = 0;
  const text = () => buffer.toString('utf8', offset);

  function readLine() {
    const end = buffer.indexOf('\r\n', offset, 'utf8');
    if (end === -1) throw new Error('Incomplete Redis response');
    const line = buffer.toString('utf8', offset, end);
    offset = end + 2;
    return line;
  }

  function readValue() {
    const type = text()[0];
    offset += 1;

    if (type === '+') return readLine();
    if (type === ':') return Number(readLine());
    if (type === '-') throw new Error(readLine());

    if (type === '$') {
      const length = Number(readLine());
      if (length === -1) return null;
      const value = buffer.toString('utf8', offset, offset + length);
      offset += length + 2;
      return value;
    }

    if (type === '*') {
      const length = Number(readLine());
      if (length === -1) return null;
      const items = [];
      for (let i = 0; i < length; i++) items.push(readValue());
      return items;
    }

    throw new Error(`Unsupported Redis response: ${type}`);
  }

  const values = [];
  while (offset < buffer.length) values.push(readValue());
  return values;
}

async function redisTlsCommand(config, command) {
  const authCommand = config.username
    ? ['AUTH', config.username, config.password]
    : ['AUTH', config.password];

  return new Promise((resolve, reject) => {
    let chunks = [];
    let settled = false;
    let authenticated = false;
    const socket = tls.connect({ host: config.host, port: config.port, servername: config.host }, () => {
      socket.write(encodeRedisCommand(authCommand));
    });

    socket.setTimeout(8000);
    socket.on('data', chunk => {
      chunks.push(chunk);
      try {
        const values = parseRespValues(Buffer.concat(chunks));
        if (!authenticated && values.length >= 1) {
          authenticated = true;
          chunks = [];
          socket.write(encodeRedisCommand(command));
          return;
        }
        if (authenticated && values.length >= 1 && !settled) {
          settled = true;
          socket.destroy();
          resolve({ result: values[0] });
        }
      } catch (_) {
        // Wait for the rest of the RESP frame.
      }
    });
    socket.on('timeout', () => {
      socket.destroy();
      if (!settled) reject(new Error('Redis request timed out'));
    });
    socket.on('error', error => {
      if (!settled) reject(error);
    });
    socket.on('end', () => {
      if (settled) return;
      try {
        const values = parseRespValues(Buffer.concat(chunks));
        settled = true;
        resolve({ result: values[0] });
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function redisCommand(command) {
  const config = parseRedisConfig();
  if (!config) throw new Error('Redis env is not configured');

  if (config.type === 'redis') {
    return redisTlsCommand(config, command);
  }

  const response = await fetch(`${config.url}/${command.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${config.token}` }
  });

  if (!response.ok) {
    throw new Error(`Redis request failed: ${response.status}`);
  }

  return response.json();
}
