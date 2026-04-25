# Chrome Image Downloader by TechNow

Chrome Extension MV3 giúp lưu ảnh trên web về `.jpg` hoặc `.png`, kể cả khi ảnh đầu vào là `.webp`, `.avif`, `.jpg`, `.jpeg`, `.png`, `.gif` hoặc định dạng ảnh khác mà Chrome decode được.

## Tính năng

- Chuột phải vào ảnh bất kỳ trên web.
- Chọn **Save image as JPG** hoặc **Save image as PNG**.
- Extension convert ảnh bằng offscreen canvas rồi tải về đúng định dạng đầu ra.
- JPG được nền trắng để tránh lỗi nền trong suốt.

## Cài đặt local

1. Mở `chrome://extensions`.
2. Bật **Developer mode**.
3. Chọn **Load unpacked**.
4. Chọn thư mục `chrome_image_downloader_by_TechNow`.

## Ghi chú

- Đầu vào: WebP/AVIF/JPEG/PNG/GIF hoặc định dạng browser-decodable khác.
- Đầu ra: chỉ `.jpg` hoặc `.png`.
- Một số website có CORS/anti-hotlink/cookie đặc biệt có thể cần nâng cấp thêm ở bản sau.
