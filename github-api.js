// github-api.js
// Module trung gian giao tiếp với GitHub REST API (Git Data API)
// Thay thế hoàn toàn `fs` để đọc/ghi file vào repository trên GitHub.

const API_BASE = 'https://api.github.com';

function getConfig() {
  const token  = process.env.GITHUB_TOKEN;
  const repo   = process.env.GITHUB_REPO   || 'sydv036/Flash-Card';
  const branch = process.env.GITHUB_BRANCH || 'master';
  if (!token) throw new Error('GITHUB_TOKEN chưa được cấu hình trong .env');
  return { token, repo, branch };
}

// ─── Fetch wrapper ──────────────────────────────────────────────────────────

async function githubFetch(endpoint, options = {}) {
  const { token } = getConfig();
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`GitHub API ${res.status}: ${errorText}`);
  }

  return res.json();
}

// ─── Low-level Git Data API ─────────────────────────────────────────────────

async function getBranchHead() {
  const { repo, branch } = getConfig();
  const data = await githubFetch(`/repos/${repo}/git/ref/heads/${branch}`);
  return data.object.sha;
}

async function getCommitData(sha) {
  const { repo } = getConfig();
  return githubFetch(`/repos/${repo}/git/commits/${sha}`);
}

async function createBlob(content, encoding = 'base64') {
  const { repo } = getConfig();
  const data = await githubFetch(`/repos/${repo}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({ content, encoding }),
  });
  return data.sha;
}

async function getFullTree(treeSha) {
  const { repo } = getConfig();
  return githubFetch(`/repos/${repo}/git/trees/${treeSha}?recursive=1`);
}

async function createTree(baseTreeSha, treeEntries) {
  const { repo } = getConfig();
  const body = { tree: treeEntries };
  if (baseTreeSha) body.base_tree = baseTreeSha;
  const data = await githubFetch(`/repos/${repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data.sha;
}

async function createCommitObj(message, treeSha, parentSha) {
  const { repo } = getConfig();
  const data = await githubFetch(`/repos/${repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] }),
  });
  return data.sha;
}

async function updateRef(commitSha) {
  const { repo, branch } = getConfig();
  await githubFetch(`/repos/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commitSha }),
  });
}

// ─── High-level API ─────────────────────────────────────────────────────────

/**
 * Commit changes (add/update files and/or delete paths) trong 1 commit duy nhất.
 *
 * @param {Object} options
 * @param {Array}  [options.filesToAdd]     - Mảng file cần thêm/cập nhật
 *   Each: { path: string, content: string|Buffer, encoding: 'utf-8'|'base64' }
 * @param {Array}  [options.pathsToDelete]  - Mảng đường dẫn thư mục/file cần xóa
 * @param {string} options.message          - Nội dung commit
 */
export async function commitChanges({ filesToAdd = [], pathsToDelete = [], message }) {
  if (filesToAdd.length === 0 && pathsToDelete.length === 0) return;

  const headSha    = await getBranchHead();
  const headCommit = await getCommitData(headSha);
  const baseTreeSha = headCommit.tree.sha;

  // Tạo blob song song để tiết kiệm thời gian
  const blobEntries = await Promise.all(
    filesToAdd.map(async (file) => {
      let blobSha;
      if (file.encoding === 'utf-8' || file.encoding === 'utf8') {
        blobSha = await createBlob(file.content, 'utf-8');
      } else {
        const b64 = Buffer.isBuffer(file.content)
          ? file.content.toString('base64')
          : file.content;
        blobSha = await createBlob(b64, 'base64');
      }
      return { path: file.path, mode: '100644', type: 'blob', sha: blobSha };
    })
  );

  let newTreeSha;

  if (pathsToDelete.length > 0) {
    // Xóa path → phải rebuild toàn bộ tree
    const fullTree = await getFullTree(baseTreeSha);

    // Giữ lại blob entries KHÔNG nằm trong danh sách xóa
    let remainingEntries = fullTree.tree
      .filter(entry => entry.type === 'blob')
      .filter(entry =>
        !pathsToDelete.some(prefix =>
          entry.path === prefix || entry.path.startsWith(prefix + '/')
        )
      )
      .map(e => ({ path: e.path, mode: e.mode, type: 'blob', sha: e.sha }));

    // Gộp file mới vào (ghi đè nếu trùng path)
    for (const newEntry of blobEntries) {
      remainingEntries = remainingEntries.filter(e => e.path !== newEntry.path);
      remainingEntries.push(newEntry);
    }

    // Tạo tree MỚI hoàn toàn (không base_tree)
    newTreeSha = await createTree(null, remainingEntries);
  } else {
    // Chỉ thêm/cập nhật → dùng base_tree cho nhanh
    newTreeSha = await createTree(baseTreeSha, blobEntries);
  }

  const newCommitSha = await createCommitObj(message, newTreeSha, headSha);
  await updateRef(newCommitSha);

  console.log(`[GitHub] ✓ ${message} (${newCommitSha.slice(0, 7)})`);
  return newCommitSha;
}

/**
 * Đọc nội dung text file từ repository.
 * @returns {{ content: string, sha: string } | null}
 */
export async function readFile(filePath) {
  try {
    const { repo, branch } = getConfig();
    const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
    const data = await githubFetch(
      `/repos/${repo}/contents/${encodedPath}?ref=${branch}`
    );
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    return { content, sha: data.sha };
  } catch {
    return null;
  }
}

/**
 * Lấy toàn bộ đường dẫn file trong repo (dùng để kiểm tra thư mục tồn tại).
 * @returns {Set<string>}
 */
export async function getRepoPaths() {
  const headSha    = await getBranchHead();
  const headCommit = await getCommitData(headSha);
  const fullTree   = await getFullTree(headCommit.tree.sha);
  return new Set(
    fullTree.tree.filter(e => e.type === 'blob').map(e => e.path)
  );
}
