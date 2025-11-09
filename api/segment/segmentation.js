import Request from "~/server/segment/Request.js";  // 在每个 api 文件里都要引入这两个文件
import Message from "~/server/segment/Message.js"  // 在每个 api 文件里都要引入这两个文件

/**
 * 接口名称：图像上传接口
 * 接口定义：此接口用于上传图像。
 * 输入：
 *   - headers：请求头，限定数据类型为 form-data。
 *   - data：FormData，类型为 form-data
 * 输出：
 *   - 在获取成功的情况下：
 *     - response，类型是 object
 *   - 在获取失败的情况下：
 *     - 无输出。
 */
export function UploadImg(FormData) {  // 在 src/views/login/detect.vue 里调用，可以去看看是如何调用的
    return Request({  // 发送请求
        method: 'POST',
        headers: {
            'Content-Type': 'application/form-data', // 设置请求头
        },
        url: '/backend/seg_single_image/',  // 与后端接口对应！！！
        data: FormData, // 使用FormData作为请求体
    }).then(function (response) {  // then 表示成功接收到响应后的操作
        if (response.status === 200) {
            Message.success("操作成功");
            
            console.log(response.data); // 检查返回的数据
            return response;  //  // 正确响应，返回数据
        } else {
            Message.error("操作失败");
        }
    }).catch(function (error) {  // catch 表示接收到错误响应后的操作
        console.log(error);
    });
}

/**
 * 接口名称：请求接口模板
 * 接口定义：此接口是接口模板，可以直接将Method，Url，formdata等作为参数传入使用。
 * 输入：
 *   - headers：请求头，限定数据类型为form-data。
 * 输出：
 *   - 在获取成功的情况下：
 *     - response，类型是object
 *   - 在获取失败的情况下：
 *     - 无输出。
 */
export function sendRequest(Method, Url, formData) {  
    return Request({  // 发送请求
        method: Method,
        headers: {
            'Content-Type': 'application/form-data', // 设置请求头
        },
        url: Url,  // 与后端接口对应！！！ 
        data: formData, 
    }).then(function (response) {  // then 表示成功接收到响应后的操作
        if (response.status === 200) {
            Message.success("操作成功");
            // console.log(response.data); // 检查返回的数据
            return response;  //  // 正确响应，返回数据
        } else {
            Message.error("操作失败");
        }
    }).catch(function (error) {  // catch 表示接收到错误响应后的操作
        console.log("Request URL: ", Url);
        console.log("Request Method: ", Method);
        console.log("Request Data: ", formData);
        console.error("Error: ", error);
    });
}
// 以下就是利用sendRequest函数实现的具体函数。
// API 1：管理员上传多张图片，后端存储到数据库中，返回图片ID和对应批次号，以及这个批次的时间
export function UploadBatchImg(img) {
    return sendRequest('POST', '/backend/upload_batch_image/', img)
}

// API 2：管理员发送带ID的请求，后端处理相应图片并返回是否成功，处理结果共有多少张，并返回一个标签列表
export function SegSingleImg(id) {
    return sendRequest('POST', '/backend/seg_single_image_from_to_db/', id)
}

// API 3：管理员发送带ID的请求，后端从数据库中查询到对应图片并返回分割和分类结果
export function GetSegResult(id) {
    return sendRequest('POST', '/backend/get_segmented_images_for_image/', id)
}

// API 4：根据日期查询数据库中的图片（返回当日所有图片）（？不知何物，没用过此API，实现也和日期无关）
export function GetImgByDate(id) {
    return sendRequest('POST', '/backend/get_all_image/', id)
}

// API 5：根据日期查询数据库中的图片（返回当日所有图片）
export function GetResultByDate(date) {
    return sendRequest('POST', '/backend/get_all_image_and_segments_of_certain_date/', date)
}