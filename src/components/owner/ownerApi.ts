export const toVietnameseOwnerError = (
  message = "",
  status = 0,
  code = "",
) => {
  const text = message.toLowerCase();
  if (code === "RATE_LIMITED")
    return "Ứng dụng đang giới hạn số thao tác. Vui lòng chờ theo thời gian Retry-After rồi thử lại.";
  if (
    status === 507 ||
    ["quota", "storage", "billing", "capacity"].some((value) =>
      text.includes(value),
    )
  ) {
    return "Kho Server không còn khả dụng hoặc đã vượt giới hạn thanh toán. Vui lòng kiểm tra dung lượng và hóa đơn Cloudflare.";
  }
  if (
    status === 429 ||
    /slowdown|too ?many requests|rate.?limit/i.test(text)
  )
    return "Cloudflare đang giới hạn số lượt tải lên. Vui lòng chờ một lát rồi thử lại.";
  if (status === 401 || status === 403 || text.includes("accessdenied"))
    return "Không có quyền truy cập Server. Vui lòng kiểm tra API token.";
  if (/[À-ỹ]/u.test(message)) return message;
  if (status >= 500)
    return "Server đang tạm thời gián đoạn. Vui lòng thử lại sau.";
  if (status >= 400)
    return "Server từ chối yêu cầu tải file. Vui lòng kiểm tra cấu hình và thử lại.";
  return "Đã xảy ra lỗi khi kết nối. Vui lòng thử lại.";
};

export const readOwnerApi = async <T>(response: Response): Promise<T> => {
  const data = (await response.json().catch(() => ({}))) as T & {
    success?: boolean;
    message?: string;
    code?: string;
  };
  if (!response.ok || data.success === false)
    throw new Error(
      toVietnameseOwnerError(data.message, response.status, data.code),
    );
  return data;
};

export const ownerErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Đã xảy ra lỗi. Vui lòng thử lại.";
