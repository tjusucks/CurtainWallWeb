import Request from "~/server/segment/Request.js";  // 在每个 api 文件里都要引入这两个文件
import Message from "~/server/segment/Message.js"  // 在每个 api 文件里都要引入这两个文件
import store from "~/store/index.js"

/**
 * 接口名称：上传图像接口
 * 接口定义：此接口用于上传图像。
 * 输入：
 *   - headers: 请求头，限定数据类型为form-data。
 *   - data: FormData，使用表单作为输入。类型是form-data。
 * 输出：
 *   - 在获取成功的情况下：
 *     - 无输出。只执行 Beginyolo(successCallback)函数。
 *   - 在获取失败的情况下：
 *     - 无输出。
 */
export function UploadImg(FormData, successCallback, errorCallback) {
  return Request({  // 发送请求
    baseURL: "http://111.231.168.12:8021",
    method: 'POST',
    headers: {
      'Content-Type': 'application/form-data', // 设置请求头
      //'Content-Type': 'application/x-www-form-urlencoded',
    },
    url: '/upload',  // 与后端接口对应！！！
    data: FormData, // 使用FormData作为请求体
  }).then(function (response) {  // then 表示成功接收到响应后的操作
    if (response.data === "successfully") {
      console.log("respons数据");
      console.log(response);
      Beginyolo(successCallback);
      Message.success("上传成功");  // 正确响应，返回数据
    } else {
      Message.success("上传失败");
      errorCallback();
    }
  }).catch(function (error) {  // catch 表示接收到错误响应后的操作
    console.log(error);
  });
}

/**
 * 接口名称：图像处理接口
 * 接口定义：此接口用于获取图像处理结果。
 * 输入：
 *   - 无输入
 * 输出：
 *   - 在获取成功的情况下：
 *     - 无输出，回调函数successfulCallback。
 *   - 在获取失败的情况下：
 *     - 无输出。
 */
export function Beginyolo(successCallback) {
  return Request({  // 发送请求
    baseURL: "http://111.231.168.12:8021",
    method: 'GET',
    url: '/yolo',  // 与后端接口对应！！！
  }).then(function (response) {  // then 表示成功接收到响应后的操作
    if (response.data === "runsuccessfully") {
      Message.success("识别成功");
      store.state.process_status = !store.state.process_status;
      console.log(response.data); // 检查返回的数据
      successCallback();
      //return response;  
    } else {
      Message.success("识别失败");
    }
  }).catch(function (error) {  // catch 表示接收到错误响应后的操作
    console.log(error);
  });
}

/**
 * 接口名称：获取所有用户权限接口
 * 接口定义：此接口用于获取所有用户权限。
 * 输入：
 *   - headers：用户认证信息authToken，用于验证用户是否有权限调用该接口。
 * 输出：
 *   - 在获取成功的情况下：
 *     - response，类型是object
 *   - 在获取失败的情况下：
 *     - 无输出。
 */
export function GetAuth() {
  console.log("token " + localStorage.getItem("authToken"));
  return Request({
    // 发送请求
    method: "GET",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("authToken")}`,
    },
    url: "/api/account/getAllPermissions", // 与后端接口对应！！！
  })
    .then(function (response) {
      // then 表示成功接收到响应后的操作
      if (response.status === 200) {
        Message.success("用户权限信息获取成功");

        console.log(response.data); // 检查返回的数据
        return response; //  // 正确响应，返回数据
      } else {
        Message.error("用户权限信息获取失败");
      }
    })
    .catch(function (error) {
      // catch 表示接收到错误响应后的操作
      console.log(error);
    });
}

/**
 * 接口名称：修改用户权限接口。
 * 接口定义：此接口用于修改用户权限。
 * 输入：
 *   - headers：用户认证信息authToken，用于验证用户是否有权限调用该接口。
 *   - data：dataToSend，调用时根据页面用户选择传入，类型是object
 * 输出：
 *   - 在获取成功的情况下：
 *     - response，类型是object
 *   - 在获取失败的情况下：
 *     - 无输出。
*/
export function updateUserPermissions(dataToSend) {
  return Request({
    // 发送请求
    method: "POST",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("authToken")}`,
    },
    data: dataToSend,
    url: "/api/account/updatePermission",
  })
    .then(function (response) {
      // then 表示成功接收到响应后的操作
      if (response.status === 200) {
        // Message.success(response.data.message);
        Message.success("权限修改成功");
        return response;
      } else {
        Message.error(response.data.message);
      }
    })
    .catch(function (error) {
      console.log(error);
    });
}
