import type { MessageDescriptor } from "@lingui/core";

export const homePageTitle: MessageDescriptor = /** i18n */ {
  id: "site.title",
  message: "Lãnh đạo Việt Nam",
  comment: "Tên sản phẩm hiển thị trong tiêu đề trang chủ.",
};

export const homePageDescription: MessageDescriptor = /** i18n */ {
  id: "site.description",
  message: "Đi về cội nguồn, định hình tương lai.",
  comment: "Câu giới thiệu ngắn của website.",
};

export const navigationHome: MessageDescriptor = /** i18n */ {
  id: "nav.home",
  message: "Trang chủ",
  comment: "Mục điều hướng đến trang chủ.",
};

export const navigationLibrary: MessageDescriptor = /** i18n */ {
  id: "nav.library",
  message: "Thư viện",
  comment: "Mục điều hướng đến thư viện bài viết.",
};

export const signIn: MessageDescriptor = /** i18n */ {
  id: "auth.signIn",
  message: "Đăng nhập",
  comment: "Nhãn nút gửi form đăng nhập.",
};

export const signUp: MessageDescriptor = /** i18n */ {
  id: "auth.signUp",
  message: "Tạo tài khoản",
  comment: "Nhãn nút gửi form đăng ký.",
};

export const email: MessageDescriptor = /** i18n */ {
  id: "auth.email",
  message: "Email",
  comment: "Nhãn trường nhập email.",
};

export const password: MessageDescriptor = /** i18n */ {
  id: "auth.password",
  message: "Mật khẩu",
  comment: "Nhãn trường nhập mật khẩu.",
};

export const displayName: MessageDescriptor = /** i18n */ {
  id: "auth.name",
  message: "Tên hiển thị",
  comment: "Nhãn trường nhập tên trong form đăng ký.",
};

export const authError: MessageDescriptor = /** i18n */ {
  id: "auth.error",
  message: "Không thể xử lý yêu cầu. Vui lòng thử lại.",
  comment: "Thông báo lỗi đăng nhập chung; không hiển thị nội dung lỗi nội bộ.",
};

export const signOut: MessageDescriptor = /** i18n */ {
  id: "auth.signOut",
  message: "Đăng xuất",
  comment: "Nhãn nút đăng xuất.",
};

export const signInPending: MessageDescriptor = /** i18n */ {
  id: "auth.pending",
  message: "Đang đăng nhập…",
  comment: "Thông báo trạng thái trong lúc gửi yêu cầu đăng nhập.",
};

export const emptyLibrary: MessageDescriptor = /** i18n */ {
  id: "content.empty",
  message: "Chưa có bài viết.",
  comment: "Thông báo thư viện đang trống cho ngôn ngữ hiện tại.",
};

export const nextPage: MessageDescriptor = /** i18n */ {
  id: "content.next",
  message: "Bài viết tiếp theo",
  comment: "Nhãn link đến trang kế tiếp trong danh sách.",
};

export const translationUnavailable: MessageDescriptor = /** i18n */ {
  id: "language.unavailable",
  message: "Chưa có bản dịch cho ngôn ngữ này.",
  comment: "Thông báo khi một bài viết chưa được dịch sang ngôn ngữ yêu cầu.",
};
